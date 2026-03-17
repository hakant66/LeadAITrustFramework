from __future__ import annotations

"""YAML-driven provenance rule engine for deterministic, explainable scoring."""

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union
import re

import yaml


CONFIG_PATH = Path(__file__).resolve().parents[2] / "config" / "provenance_rules.yaml"


class ProvenanceRulesError(ValueError):
    pass


@dataclass(frozen=True)
class PathToken:
    name: Optional[str]
    index: Optional[Union[int, str]]


def _load_rules_config(path: Path) -> Dict[str, Any]:
    if not path.exists():
        raise FileNotFoundError(f"Provenance rules config not found: {path}")
    with path.open("r", encoding="utf-8") as handle:
        data = yaml.safe_load(handle) or {}

    for key in ("version", "levels", "fields", "rollup"):
        if key not in data:
            raise ProvenanceRulesError(f"Missing required rules key: {key}")
    if not isinstance(data.get("levels"), dict):
        raise ProvenanceRulesError("Rules 'levels' must be a mapping.")
    if not isinstance(data.get("fields"), dict):
        raise ProvenanceRulesError("Rules 'fields' must be a mapping.")
    return data


@lru_cache(maxsize=1)
def _load_rules_config_cached() -> Dict[str, Any]:
    return _load_rules_config(CONFIG_PATH)


def load_rules_config(path: Optional[Path] = None) -> Dict[str, Any]:
    """Load provenance rules from YAML (cached by default)."""
    if path is None:
        return _load_rules_config_cached()
    return _load_rules_config(path)


def parse_path(path: str) -> List[PathToken]:
    tokens: List[PathToken] = []
    for segment in path.split("."):
        if not segment:
            continue
        match = re.match(r"^(?P<name>[^\[\]]+)?(?:\[(?P<index>\*|\d+)\])?$", segment)
        if not match:
            raise ProvenanceRulesError(f"Invalid path segment: {segment}")
        name = match.group("name") or None
        index = match.group("index")
        if index is not None and index != "*":
            index = int(index)
        tokens.append(PathToken(name=name, index=index))
    return tokens


def resolve_path(data: Any, path: str) -> List[Any]:
    """Resolve a JSON-like path into a list of values (supports [index] and [*])."""
    values: List[Any] = [data]
    for token in parse_path(path):
        next_values: List[Any] = []
        for current in values:
            value = current
            if token.name is not None:
                if isinstance(current, dict) and token.name in current:
                    value = current[token.name]
                else:
                    value = None
            if token.index is None:
                next_values.append(value)
            elif token.index == "*":
                if isinstance(value, list):
                    next_values.extend(value)
                elif isinstance(value, dict):
                    next_values.extend(list(value.values()))
                else:
                    next_values.append(None)
            else:
                if isinstance(value, list) and 0 <= token.index < len(value):
                    next_values.append(value[token.index])
                else:
                    next_values.append(None)
        values = next_values
    return values if values else [None]


def _is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def _coerce_number(value: Any) -> Optional[float]:
    if _is_number(value):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value)
        except ValueError:
            return None
    return None


def _eval_operator(op: str, value: Any, expected: Any) -> bool:
    if value is None:
        if op == "is_null":
            return True
        if op == "is_empty":
            return True
        if op == "not_empty":
            return False
        return False

    if op == "is_null":
        return False

    if op == "eq":
        return value == expected
    if op == "ne":
        return value != expected
    if op == "in":
        if expected is None:
            return False
        if isinstance(value, (list, tuple, set)):
            return any(item in expected for item in value)
        return value in expected
    if op == "not_in":
        if expected is None:
            return False
        if isinstance(value, (list, tuple, set)):
            return all(item not in expected for item in value)
        return value not in expected
    if op in ("lt", "lte", "gt", "gte"):
        left = _coerce_number(value)
        right = _coerce_number(expected)
        if left is None or right is None:
            return False
        if op == "lt":
            return left < right
        if op == "lte":
            return left <= right
        if op == "gt":
            return left > right
        if op == "gte":
            return left >= right
    if op == "is_empty":
        if isinstance(value, (str, list, dict, tuple, set)):
            return len(value) == 0
        return False
    if op == "not_empty":
        if isinstance(value, (str, list, dict, tuple, set)):
            return len(value) > 0
        return False
    if op == "is_bool":
        return isinstance(value, bool)
    if op == "is_number":
        return _is_number(value)
    if op == "is_empty_list":
        return isinstance(value, list) and len(value) == 0
    if op == "not_empty_list":
        return isinstance(value, list) and len(value) > 0
    if op == "contains_all":
        if not isinstance(value, list):
            return False
        expected_list = expected if isinstance(expected, list) else [expected]
        return all(item in value for item in expected_list)
    if op == "contains_any":
        if not isinstance(value, list):
            return False
        expected_list = expected if isinstance(expected, list) else [expected]
        return any(item in value for item in expected_list)

    raise ProvenanceRulesError(f"Unknown operator: {op}")


def _evaluate_condition(condition: Dict[str, Any], facts: Dict[str, Any]) -> Tuple[bool, Dict[str, Any]]:
    if "all" in condition:
        results = [
            _evaluate_condition(child, facts) for child in condition.get("all", [])
        ]
        ok = all(result for result, _ in results)
        return ok, {"type": "all", "result": ok, "children": [dbg for _, dbg in results]}

    if "any" in condition:
        results = [
            _evaluate_condition(child, facts) for child in condition.get("any", [])
        ]
        ok = any(result for result, _ in results)
        return ok, {"type": "any", "result": ok, "children": [dbg for _, dbg in results]}

    path = condition.get("path")
    op = condition.get("op")
    expected = condition.get("value")
    if not path or not op:
        raise ProvenanceRulesError("Leaf condition must include path and op.")

    values = resolve_path(facts, path)
    matches = [_eval_operator(op, value, expected) for value in values]
    ok = any(matches)
    return ok, {
        "type": "leaf",
        "path": path,
        "op": op,
        "expected": expected,
        "values": values,
        "matches": matches,
        "result": ok,
    }


def _level_num(levels: Dict[str, int], level: str) -> int:
    if level not in levels:
        raise ProvenanceRulesError(f"Unknown level: {level}")
    return int(levels[level])


def evaluate_provenance(
    manifest_facts: Dict[str, Any],
    include_debug: bool = True,
    rules: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Evaluate provenance rules against manifest facts and return a score report."""
    config = rules or load_rules_config()
    levels = config["levels"]
    fields_cfg = config["fields"]
    gates_cfg = config.get("hard_gates", [])
    rollup_cfg = config["rollup"]
    if rollup_cfg.get("mode") not in (None, "gated_floor"):
        raise ProvenanceRulesError("Unsupported rollup mode.")

    gate_results: List[Dict[str, Any]] = []
    forced_levels: List[int] = []
    for gate in gates_cfg:
        condition = gate.get("when")
        if condition is None:
            continue
        matched, trace = _evaluate_condition(condition, manifest_facts)
        if not matched:
            continue
        forced_level = gate.get("effect", {}).get("overall_level", "P0")
        forced_levels.append(_level_num(levels, forced_level))
        gate_output = {
            "gate_id": gate.get("id"),
            "forced_level": forced_level,
            "reasons": gate.get("effect", {}).get("reasons", []),
        }
        if include_debug:
            gate_output["debug"] = {"matched": True, "trace": trace}
        gate_results.append(gate_output)

    field_results: List[Dict[str, Any]] = []
    for field_name, field_cfg in fields_cfg.items():
        best_level = "P0"
        best_score = _level_num(levels, best_level)
        best_rule_id: Optional[str] = None
        reasons: List[Dict[str, Any]] = []
        rule_debug: List[Dict[str, Any]] = []
        for rule in field_cfg.get("rules", []):
            condition = rule.get("when")
            if condition is None:
                continue
            matched, trace = _evaluate_condition(condition, manifest_facts)
            rule_debug.append(
                {
                    "rule_id": rule.get("id"),
                    "level": rule.get("level"),
                    "matched": matched,
                    "trace": trace,
                }
            )
            if not matched:
                continue
            level = rule.get("level", "P0")
            score = _level_num(levels, level)
            if score > best_score:
                best_level = level
                best_score = score
                best_rule_id = rule.get("id")
                reasons = rule.get("reasons") or (
                    [rule["reason"]] if "reason" in rule else []
                )

        if best_rule_id is None:
            reasons = [
                {"code": "NO_RULE_MATCHED", "message": "No rule matched for field."}
            ]

        field_output = {
            "field": field_name,
            "level": best_level,
            "score": best_score,
            "matched_rule": best_rule_id,
            "reasons": reasons,
        }
        if include_debug:
            field_output["debug"] = {"rules": rule_debug}
        field_results.append(field_output)

    rollup_debug: Dict[str, Any] = {}
    mandatory_fields = rollup_cfg.get("mandatory_fields", [])
    mandatory_levels = {
        field["field"]: field["score"]
        for field in field_results
        if field["field"] in mandatory_fields
    }
    mandatory_ok = all(score >= _level_num(levels, "P2") for score in mandatory_levels.values()) if mandatory_fields else True

    total_fields = len(field_results)
    p1_fraction = 0.0
    p3_fraction = 0.0
    if total_fields:
        p1_fraction = len([f for f in field_results if f["score"] >= _level_num(levels, "P1")]) / total_fields
        p3_fraction = len([f for f in field_results if f["score"] >= _level_num(levels, "P3")]) / total_fields

    thresholds = rollup_cfg.get("thresholds", {})
    p1_threshold = float(thresholds.get("p1_fraction", 0.6))
    p3_threshold = float(thresholds.get("p3_fraction", 0.6))
    continuous_ok = True
    if rollup_cfg.get("require_continuous_ok"):
        continuous_path = rollup_cfg.get("continuous_ok_path", "signals.continuous_ok")
        values = resolve_path(manifest_facts, continuous_path)
        continuous_ok = any(value is True for value in values)

    overall_level = "P0"
    if p1_fraction >= p1_threshold:
        overall_level = "P1"
    if mandatory_ok:
        overall_level = "P2"
    if mandatory_ok and p3_fraction >= p3_threshold and continuous_ok:
        overall_level = "P3"

    rollup_debug.update(
        {
            "mandatory_fields": mandatory_fields,
            "mandatory_levels": mandatory_levels,
            "mandatory_ok": mandatory_ok,
            "p1_fraction": p1_fraction,
            "p3_fraction": p3_fraction,
            "p1_threshold": p1_threshold,
            "p3_threshold": p3_threshold,
            "continuous_ok": continuous_ok,
        }
    )

    forced = False
    if forced_levels:
        forced = True
        forced_score = min(forced_levels)
        score_to_level = {score: level for level, score in levels.items()}
        if forced_score not in score_to_level:
            raise ProvenanceRulesError("Unable to resolve forced level.")
        overall_level = score_to_level[forced_score]
        rollup_debug["forced_by_gates"] = True

    overall_output = {
        "level": overall_level,
        "score": _level_num(levels, overall_level),
        "forced": forced,
        "reasons": [
            {
                "code": "GATE_OVERRIDE" if forced else "ROLLUP",
                "message": "Overall level forced by gate." if forced else "Overall level derived from field rollup.",
            }
        ],
    }
    if include_debug:
        overall_output["debug"] = rollup_debug

    result: Dict[str, Any] = {
        "overall": overall_output,
        "fields": field_results,
        "gates": gate_results,
    }
    if include_debug:
        result["debug"] = {"rollup": rollup_debug}
    return result
