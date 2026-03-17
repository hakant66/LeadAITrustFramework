from __future__ import annotations

from app.celery_app import celery_app
from app.services.decay_engine import (
    apply_decay_for_project,
    load_signal,
    mark_signal_status,
)


@celery_app.task(name="trust_decay.process_signal")
def process_signal(signal_id: str) -> dict:
    signal = load_signal(signal_id)
    if not signal:
        return {"ok": False, "error": "signal_not_found", "signal_id": signal_id}

    if signal.get("status") == "resolved":
        return {"ok": True, "skipped": "resolved", "signal_id": signal_id}

    project_slug = signal.get("project_slug")
    if not project_slug:
        return {"ok": False, "error": "missing_project_slug", "signal_id": signal_id}

    result = apply_decay_for_project(
        project_slug,
        triggered_signal_id=signal_id,
        action="decay_applied",
    )
    mark_signal_status(signal_id, "processed")
    result["signal_id"] = signal_id
    result["status"] = "processed"
    return result


@celery_app.task(name="trust_decay.recompute_project")
def recompute_project(project_slug: str, action: str = "decay_recomputed") -> dict:
    return apply_decay_for_project(project_slug, triggered_signal_id=None, action=action)
