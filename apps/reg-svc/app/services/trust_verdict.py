from __future__ import annotations

from typing import Dict, Optional, List

TOL_ORDER = ["TOL-0", "TOL-1", "TOL-2", "TOL-3"]
TOL_THRESHOLDS = {
    "TOL-0": 0,
    "TOL-1": 40,
    "TOL-2": 60,
    "TOL-3": 80,
}

ENV_GATING_RULES = {
    "dev": "TOL-0",
    "test": "TOL-1",
    "staging": "TOL-1",
    "prod": "TOL-2",
}


def compute_tol(axis_scores: Dict[str, Optional[float]]) -> str:
    scores = [s if s is not None else 0.0 for s in axis_scores.values()]
    if not scores:
        return "TOL-0"
    min_score = min(scores)

    if min_score >= TOL_THRESHOLDS["TOL-3"]:
        return "TOL-3"
    if min_score >= TOL_THRESHOLDS["TOL-2"]:
        return "TOL-2"
    if min_score >= TOL_THRESHOLDS["TOL-1"]:
        return "TOL-1"
    return "TOL-0"


def allowed_environments(tol: str, rules: Dict[str, str] | None = None) -> List[str]:
    rule_set = rules or ENV_GATING_RULES
    try:
        tol_idx = TOL_ORDER.index(tol)
    except ValueError:
        tol_idx = 0

    allowed: List[str] = []
    for env, required in rule_set.items():
        try:
            req_idx = TOL_ORDER.index(required)
        except ValueError:
            req_idx = len(TOL_ORDER)
        if tol_idx >= req_idx:
            allowed.append(env)
    return allowed
