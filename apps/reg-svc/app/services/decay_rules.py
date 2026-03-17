from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional

AXIS_KEYS = ("safety", "compliance", "provenance")


@dataclass(frozen=True)
class DecayRule:
    rule_key: str
    axis_key: str
    mode: str  # delta | cap | set
    delta: float | None = None
    cap: float | None = None
    set_value: float | None = None
    description: str | None = None


@dataclass(frozen=True)
class MonitoringSignal:
    id: str
    signal_type: str
    axis_key: Optional[str]
    details: Optional[dict]


DECAY_RULES: Dict[str, DecayRule] = {
    "missing_review": DecayRule(
        rule_key="missing_review",
        axis_key="safety",
        mode="delta",
        delta=-1.0,
        description="No review in 90+ days",
    ),
    "model_drift": DecayRule(
        rule_key="model_drift",
        axis_key="safety",
        mode="delta",
        delta=-5.0,
        description="Drift signal detected",
    ),
    "expired_dpia": DecayRule(
        rule_key="expired_dpia",
        axis_key="compliance",
        mode="delta",
        delta=-10.0,
        description="DPIA expired",
    ),
    "regulatory_update": DecayRule(
        rule_key="regulatory_update",
        axis_key="compliance",
        mode="cap",
        cap=50.0,
        description="Regulatory update pending review",
    ),
    "broken_evidence_links": DecayRule(
        rule_key="broken_evidence_links",
        axis_key="provenance",
        mode="delta",
        delta=-10.0,
        description="Evidence links invalid",
    ),
    "missing_evidence": DecayRule(
        rule_key="missing_evidence",
        axis_key="provenance",
        mode="delta",
        delta=-15.0,
        description="Required evidence missing",
    ),
    "artifact_hash_mismatch": DecayRule(
        rule_key="artifact_hash_mismatch",
        axis_key="provenance",
        mode="set",
        set_value=0.0,
        description="Artifact hash mismatch",
    ),
}


class DecayComputation(dict):
    pass


def _resolve_axis(signal: MonitoringSignal, rule: DecayRule) -> Optional[str]:
    if signal.axis_key in AXIS_KEYS:
        return signal.axis_key
    if rule.axis_key in AXIS_KEYS:
        return rule.axis_key
    return None


def apply_decay(
    base_scores: Dict[str, Optional[float]],
    signals: Iterable[MonitoringSignal],
) -> tuple[Dict[str, float], Dict[str, dict], List[dict]]:
    buckets: Dict[str, dict] = {
        axis: {"delta": 0.0, "cap": None, "set": None, "rules": []}
        for axis in AXIS_KEYS
    }
    applied: List[dict] = []

    for signal in signals:
        rule = DECAY_RULES.get(signal.signal_type)
        if not rule:
            continue
        axis = _resolve_axis(signal, rule)
        if not axis:
            continue

        bucket = buckets[axis]
        entry = {
            "signal_id": signal.id,
            "signal_type": signal.signal_type,
            "rule_key": rule.rule_key,
            "axis_key": axis,
            "mode": rule.mode,
            "delta": rule.delta,
            "cap": rule.cap,
            "set_value": rule.set_value,
            "description": rule.description,
            "details": signal.details,
        }
        bucket["rules"].append(entry)
        applied.append(entry)

        if rule.mode == "delta" and rule.delta is not None:
            bucket["delta"] += float(rule.delta)
        elif rule.mode == "cap" and rule.cap is not None:
            bucket["cap"] = (
                rule.cap if bucket["cap"] is None else min(bucket["cap"], rule.cap)
            )
        elif rule.mode == "set" and rule.set_value is not None:
            bucket["set"] = (
                rule.set_value
                if bucket["set"] is None
                else min(bucket["set"], rule.set_value)
            )

    decayed: Dict[str, float] = {}
    breakdown: Dict[str, dict] = {}
    for axis in AXIS_KEYS:
        base = base_scores.get(axis)
        base_score = float(base or 0.0)
        score = base_score
        bucket = buckets[axis]

        if bucket["set"] is not None:
            score = min(score, float(bucket["set"]))
        if bucket["cap"] is not None:
            score = min(score, float(bucket["cap"]))
        score += float(bucket["delta"])
        score = max(0.0, min(100.0, score))

        decayed[axis] = round(score, 2)
        breakdown[axis] = {
            "base": base_score,
            "decayed": decayed[axis],
            "delta": round(bucket["delta"], 2),
            "cap": bucket["cap"],
            "set": bucket["set"],
            "rules": bucket["rules"],
        }

    return decayed, breakdown, applied
