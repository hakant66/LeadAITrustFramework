from __future__ import annotations

from typing import Dict, List, Optional
from uuid import uuid4

from sqlalchemy import text, bindparam
from sqlalchemy.dialects.postgresql import JSONB

from app.db import engine
from app.services.core_client import fetch_axis_scores, emit_audit_event
from app.services.decay_rules import MonitoringSignal, apply_decay
from app.services.trust_verdict import compute_tol, allowed_environments, ENV_GATING_RULES


def _load_active_signals(project_slug: str) -> List[MonitoringSignal]:
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                """
                SELECT id, signal_type, axis_key, details_json
                FROM trust_monitoring_signals
                WHERE project_slug = :slug AND status != 'resolved'
                ORDER BY created_at ASC
                """
            ),
            {"slug": project_slug},
        ).mappings().all()
    return [
        MonitoringSignal(
            id=row["id"],
            signal_type=row["signal_type"],
            axis_key=row.get("axis_key"),
            details=row.get("details_json"),
        )
        for row in rows
    ]


def _insert_decay_event(
    signal_id: str,
    project_slug: str,
    axis_key: str,
    rule_key: str,
    decay_delta: Optional[float],
    previous_score: Optional[float],
    new_score: Optional[float],
    details: Optional[dict],
) -> str:
    event_id = str(uuid4())
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                INSERT INTO trust_decay_events (
                    id, signal_id, project_slug, axis_key, rule_key,
                    decay_delta, previous_score, new_score, details_json
                )
                VALUES (
                    :id, :signal_id, :project_slug, :axis_key, :rule_key,
                    :decay_delta, :previous_score, :new_score, :details
                )
                """
            ).bindparams(bindparam("details", type_=JSONB)),
            {
                "id": event_id,
                "signal_id": signal_id,
                "project_slug": project_slug,
                "axis_key": axis_key,
                "rule_key": rule_key,
                "decay_delta": decay_delta,
                "previous_score": previous_score,
                "new_score": new_score,
                "details": details,
            },
        )
    return event_id


def _insert_trust_evaluation(
    project_slug: str,
    axis_scores: Dict[str, Optional[float]],
    tol: str,
) -> str:
    eval_id = str(uuid4())
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                INSERT INTO trust_evaluations (
                    id, project_slug, axis_scores, tol_level, evaluated_at
                )
                VALUES (:id, :slug, :axis_scores, :tol, now())
                """
            ).bindparams(bindparam("axis_scores", type_=JSONB)),
            {
                "id": eval_id,
                "slug": project_slug,
                "axis_scores": axis_scores,
                "tol": tol,
            },
        )
    return eval_id


def _insert_audit(
    evaluation_id: str,
    action: str,
    actor: str,
    details: dict,
) -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                INSERT INTO trust_evaluation_audit (
                    evaluation_id, action, actor, details_json
                )
                VALUES (:evaluation_id, :action, :actor, :details)
                """
            ).bindparams(bindparam("details", type_=JSONB)),
            {
                "evaluation_id": evaluation_id,
                "action": action,
                "actor": actor,
                "details": details,
            },
        )


def apply_decay_for_project(
    project_slug: str,
    triggered_signal_id: Optional[str] = None,
    action: str = "decay_applied",
) -> Dict[str, object]:
    base_scores = fetch_axis_scores(project_slug)
    active_signals = _load_active_signals(project_slug)

    decayed_scores, breakdown, applied = apply_decay(base_scores, active_signals)
    tol = compute_tol(decayed_scores)
    allowed = allowed_environments(tol, ENV_GATING_RULES)

    evaluation_id = _insert_trust_evaluation(project_slug, decayed_scores, tol)

    audit_details = {
        "project_slug": project_slug,
        "base_axis_scores": base_scores,
        "decayed_axis_scores": decayed_scores,
        "axis_breakdown": breakdown,
        "signals": [
            {
                "signal_id": s.id,
                "signal_type": s.signal_type,
                "axis_key": s.axis_key,
            }
            for s in active_signals
        ],
        "allowed_environments": allowed,
    }
    if triggered_signal_id:
        audit_details["triggered_signal_id"] = triggered_signal_id

    _insert_audit(
        evaluation_id,
        action,
        actor="reg-svc",
        details=audit_details,
    )

    emit_audit_event(
        event_type="trust_decay_applied",
        actor="reg-svc",
        source_service="reg-svc",
        object_type="trust_evaluation",
        object_id=evaluation_id,
        project_slug=project_slug,
        details=audit_details,
    )

    if triggered_signal_id:
        for entry in applied:
            if entry.get("signal_id") != triggered_signal_id:
                continue
            axis = entry.get("axis_key")
            if not axis:
                continue
            prev = base_scores.get(axis)
            _insert_decay_event(
                signal_id=triggered_signal_id,
                project_slug=project_slug,
                axis_key=axis,
                rule_key=entry.get("rule_key"),
                decay_delta=entry.get("delta"),
                previous_score=prev,
                new_score=decayed_scores.get(axis),
                details={"rule": entry},
            )

    return {
        "evaluation_id": evaluation_id,
        "project_slug": project_slug,
        "axis_scores": decayed_scores,
        "tol": tol,
        "allowed_environments": allowed,
        "breakdown": breakdown,
    }


def mark_signal_status(signal_id: str, status: str) -> None:
    with engine.begin() as conn:
        if status == "processed":
            conn.execute(
                text(
                    """
                    UPDATE trust_monitoring_signals
                       SET status = :status,
                           processed_at = now()
                     WHERE id = :id
                    """
                ),
                {"status": status, "id": signal_id},
            )
        elif status == "resolved":
            conn.execute(
                text(
                    """
                    UPDATE trust_monitoring_signals
                       SET status = :status,
                           resolved_at = now()
                     WHERE id = :id
                    """
                ),
                {"status": status, "id": signal_id},
            )
        else:
            conn.execute(
                text(
                    """
                    UPDATE trust_monitoring_signals
                       SET status = :status
                     WHERE id = :id
                    """
                ),
                {"status": status, "id": signal_id},
            )


def load_signal(signal_id: str) -> Optional[dict]:
    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT * FROM trust_monitoring_signals WHERE id = :id"),
            {"id": signal_id},
        ).mappings().first()
    return dict(row) if row else None
