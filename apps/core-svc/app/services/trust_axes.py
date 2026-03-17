from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, List, Dict, Optional, Tuple


AXIS_KEYS = ("safety", "compliance", "provenance")


@dataclass(frozen=True)
class ControlAxisScore:
    control_id: str
    kpi_key: Optional[str]
    control_name: Optional[str]
    pillar_key: Optional[str]
    pillar_name: Optional[str]
    axis_key: Optional[str]
    weight: float
    score_pct: Optional[float]


@dataclass(frozen=True)
class AxisMappingItem:
    pillar_key: str
    axis_key: str
    notes: Optional[str] = None


def _axis_from_mapping(
    control: ControlAxisScore,
    mapping_by_key: Dict[str, str],
) -> Tuple[Optional[str], Optional[str]]:
    if control.axis_key in AXIS_KEYS:
        return control.axis_key, "control"

    if control.pillar_key:
        axis = mapping_by_key.get(control.pillar_key)
        if axis in AXIS_KEYS:
            return axis, "pillar_map"

    return None, None


def rollup_axis_scores(
    controls: Iterable[ControlAxisScore],
    mapping: Iterable[AxisMappingItem],
) -> Dict[str, Dict[str, object]]:
    mapping_by_key = {item.pillar_key: item.axis_key for item in mapping}
    buckets: Dict[str, Dict[str, object]] = {
        axis: {"sum": 0.0, "weight": 0.0, "controls": []}
        for axis in AXIS_KEYS
    }

    for control in controls:
        if control.score_pct is None:
            continue

        axis, source = _axis_from_mapping(control, mapping_by_key)
        if axis is None:
            continue

        weight = float(control.weight or 1.0)
        buckets[axis]["sum"] += float(control.score_pct) * weight
        buckets[axis]["weight"] += weight
        buckets[axis]["controls"].append(
            {
                "control_id": control.control_id,
                "kpi_key": control.kpi_key,
                "control_name": control.control_name,
                "pillar_key": control.pillar_key,
                "pillar_name": control.pillar_name,
                "axis_key": axis,
                "axis_source": source,
                "weight": weight,
                "score_pct": float(control.score_pct),
            }
        )

    results: Dict[str, Dict[str, object]] = {}
    for axis, data in buckets.items():
        weight = float(data["weight"])
        score = None if weight == 0 else round(float(data["sum"]) / weight, 2)
        results[axis] = {
            "axis_key": axis,
            "score_pct": score,
            "controls": data["controls"],
        }

    return results
