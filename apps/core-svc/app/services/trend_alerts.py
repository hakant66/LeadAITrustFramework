"""
Trend-based alert evaluation: load alert_rules, compute current/previous metric
values from control_values_history and provenance_evaluations, and upsert trend_alerts.
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID, uuid4

from app.db_async import get_pool


_COLUMNS_CACHE: Dict[str, set[str]] = {}


async def _get_columns(pool, table_name: str) -> set[str]:
    cache_key = f"public.{table_name}"
    if cache_key in _COLUMNS_CACHE:
        return _COLUMNS_CACHE[cache_key]
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = $1
            """,
            table_name,
        )
    cols = {r["column_name"] for r in rows}
    _COLUMNS_CACHE[cache_key] = cols
    return cols


async def _get_pillar_override_value(
    pool,
    entity_id: UUID,
    project_slug: str,
    pillar_key: str,
    at_or_before: datetime,
) -> Optional[float]:
    """
    Return pillar score for (entity, project, pillar) using pillar_overrides.calculated_score
    (fallback to score_pct). If history exists, resolve the value as-of at_or_before.
    """
    # Resolve project_id from entity_projects
    async with pool.acquire() as conn:
        proj = await conn.fetchrow(
            """
            SELECT id
            FROM entity_projects
            WHERE entity_id = $1 AND slug = $2
            """,
            entity_id,
            project_slug,
        )
        if not proj:
            return None
        project_id = proj["id"]

    po_cols = await _get_columns(pool, "pillar_overrides")
    has_calc = "calculated_score" in po_cols
    has_score_pct = "score_pct" in po_cols
    if not (has_calc or has_score_pct):
        return None

    # Prefer history-as-of when available for trend comparisons
    poh_cols = await _get_columns(pool, "pillar_overrides_history")
    has_history = len(poh_cols) > 0

    value_expr = (
        "COALESCE(calculated_score, score_pct)"
        if has_calc and has_score_pct
        else ("calculated_score" if has_calc else "score_pct")
    )

    if has_history:
        include_entity = "entity_id" in poh_cols
        where_entity = "AND entity_id = $4" if include_entity else ""
        async with pool.acquire() as conn:
            sql = f"""
            SELECT {value_expr} AS v
            FROM pillar_overrides_history
            WHERE project_id = $1
              AND lower(pillar_key) = $2
              AND COALESCE(changed_at, audit_ts) <= $3
              {where_entity}
            ORDER BY COALESCE(changed_at, audit_ts) DESC, audit_ts DESC
            LIMIT 1
            """
            row = (
                await conn.fetchrow(sql, project_id, pillar_key.lower(), at_or_before, entity_id)
                if include_entity
                else await conn.fetchrow(sql, project_id, pillar_key.lower(), at_or_before)
            )
            if row and row["v"] is not None:
                return float(row["v"])

    # Fallback: current value from pillar_overrides table
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            f"""
            SELECT {value_expr} AS v
            FROM pillar_overrides
            WHERE entity_id = $1 AND project_id = $2 AND lower(pillar_key) = $3
            LIMIT 1
            """,
            entity_id,
            project_id,
            pillar_key.lower(),
        )
        if row and row["v"] is not None:
            return float(row["v"])

    return None


async def _get_project_ids_for_entity(pool, entity_id: UUID, project_slug: Optional[str]) -> List[Tuple[str, str]]:
    """Return list of (project_slug, project_name) for entity, optionally filtered by project_slug."""
    async with pool.acquire() as conn:
        if project_slug:
            row = await conn.fetchrow(
                """
                SELECT slug, name FROM entity_projects
                WHERE entity_id = $1 AND slug = $2
                """,
                entity_id,
                project_slug,
            )
            if row:
                return [(row["slug"], row["name"] or row["slug"])]
            return []
        rows = await conn.fetch(
            """
            SELECT slug, name FROM entity_projects
            WHERE entity_id = $1
            ORDER BY name NULLS FIRST, slug
            """,
            entity_id,
        )
        return [(r["slug"], r["name"] or r["slug"]) for r in rows]


async def _get_metric_value(
    pool,
    entity_id: UUID,
    project_slug: str,
    metric: str,
    at_or_before: datetime,
) -> Optional[float]:
    """
    Get a single metric value (overall or pillar) for the project at the given time.
    - metric "overall": weighted average of pillar scores for the bucket ending at_or_before.
    - metric "pillar:<key>": average normalized_pct for that pillar for the bucket.
    Uses control_values_history; falls back to provenance_evaluations for overall when available.
    """
    bucket = at_or_before
    entity_str = str(entity_id)

    # Try provenance_evaluations for overall (one row per evaluation)
    if metric == "overall":
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT overall_score_pct
                FROM provenance_evaluations
                WHERE entity_id = $1 AND project_slug = $2 AND evaluated_at <= $3
                ORDER BY evaluated_at DESC
                LIMIT 1
                """,
                entity_id,
                project_slug,
                bucket,
            )
            if row and row["overall_score_pct"] is not None:
                return float(row["overall_score_pct"])

    # control_values_history: get bucket-aggregated normalized_pct
    if metric == "overall":
        # Weighted average by pillar (simplified: equal weight if no pillar_overrides)
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                WITH vals AS (
                  SELECT
                    date_trunc('week', COALESCE(v.observed_at, v.updated_at)) AS bucket,
                    v.normalized_pct::float8 AS pct,
                    COALESCE(p.key, lower(trim(c.pillar))) AS pillar_key
                  FROM control_values_history v
                  LEFT JOIN controls c ON c.id = v.control_id
                  LEFT JOIN pillars p ON lower(trim(p.name)) = lower(trim(c.pillar))
                  WHERE v.project_slug = $1 AND v.entity_id = $2
                    AND COALESCE(v.observed_at, v.updated_at) <= $3
                )
                SELECT bucket, avg(pct)::float8 AS avg_pct
                FROM vals
                WHERE bucket <= $3
                GROUP BY bucket
                ORDER BY bucket DESC
                LIMIT 1
                """,
                project_slug,
                entity_str,
                bucket,
            )
            if rows:
                return float(rows[0]["avg_pct"] or 0)
            return None

    if metric.startswith("pillar:"):
        pillar_key = metric.replace("pillar:", "").strip().lower()

        # Prefer pillar_overrides.calculated_score (per entity+project+pillar) when present.
        override_val = await _get_pillar_override_value(pool, entity_id, project_slug, pillar_key, bucket)
        if override_val is not None:
            return override_val

        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                WITH vals AS (
                  SELECT
                    date_trunc('week', COALESCE(v.observed_at, v.updated_at)) AS bucket,
                    v.normalized_pct::float8 AS pct
                  FROM control_values_history v
                  INNER JOIN controls c ON c.id = v.control_id
                  INNER JOIN pillars p ON (
                    lower(trim(p.name)) = lower(trim(c.pillar))
                    OR lower(p.key) = lower(trim(c.pillar))
                  )
                  WHERE v.project_slug = $1 AND v.entity_id = $2
                    AND (lower(p.key) = $3 OR lower(trim(c.pillar)) = $3)
                    AND COALESCE(v.observed_at, v.updated_at) <= $4
                )
                SELECT bucket, avg(pct)::float8 AS avg_pct
                FROM vals
                WHERE bucket <= $4
                GROUP BY bucket
                ORDER BY bucket DESC
                LIMIT 1
                """,
                project_slug,
                entity_str,
                pillar_key,
                bucket,
            )
            if rows:
                return float(rows[0]["avg_pct"] or 0)
            return None

    return None


async def compute_trend_alerts() -> List[Dict[str, Any]]:
    """
    Load all enabled alert_rules, evaluate each (threshold or trend_drop), and
    insert/update trend_alerts. Returns list of created/updated alert summaries.
    """
    now = datetime.now(timezone.utc)
    pool = await get_pool()
    results: List[Dict[str, Any]] = []

    async with pool.acquire() as conn:
        rules = await conn.fetch(
            """
            SELECT id, entity_id, project_slug, name, rule_type, metric, threshold_pct, window_days, severity
            FROM alert_rules
            WHERE enabled = true
            """
        )

    for rule in rules:
        rule_id = rule["id"]
        entity_id = rule["entity_id"]
        project_slug = rule["project_slug"]
        name = rule["name"]
        rule_type = rule["rule_type"]
        metric = rule["metric"]
        threshold_pct = float(rule["threshold_pct"] or 0)
        window_days = rule["window_days"]
        severity = rule["severity"] or "medium"

        projects = await _get_project_ids_for_entity(pool, entity_id, project_slug)
        for proj_slug, proj_name in projects:
            try:
                value_now = await _get_metric_value(pool, entity_id, proj_slug, metric, now)
                if value_now is None:
                    continue

                fired = False
                value_before: Optional[float] = None
                message = ""

                if rule_type == "threshold":
                    if value_now < threshold_pct:
                        fired = True
                        message = (
                            f"Score for {metric} is {value_now:.1f}% (below threshold {threshold_pct}%)."
                        )
                elif rule_type == "trend_drop" and window_days:
                    before_dt = now - timedelta(days=window_days)
                    value_before = await _get_metric_value(pool, entity_id, proj_slug, metric, before_dt)
                    if value_before is not None and value_before > 0:
                        drop_pct = value_before - value_now
                        if drop_pct >= threshold_pct:
                            fired = True
                            message = (
                                f"{metric} dropped by {drop_pct:.1f}% over {window_days} days "
                                f"(from {value_before:.1f}% to {value_now:.1f}%)."
                            )

                if not fired:
                    # Resolve any open trend_alert for this rule+project
                    async with pool.acquire() as conn:
                        await conn.execute(
                            """
                            UPDATE trend_alerts
                            SET status = 'resolved', resolved_at = NOW(), updated_at = NOW()
                            WHERE rule_id = $1 AND project_slug = $2 AND entity_id = $3 AND status = 'open'
                            """,
                            rule_id,
                            proj_slug,
                            entity_id,
                        )
                    continue

                alert_type = "trend_threshold" if rule_type == "threshold" else "trend_drop"
                details = {
                    "rule_name": name,
                    "metric": metric,
                    "threshold_pct": threshold_pct,
                    "window_days": window_days,
                    "project_name": proj_name,
                }

                async with pool.acquire() as conn:
                    existing = await conn.fetchrow(
                        """
                        SELECT id, status FROM trend_alerts
                        WHERE rule_id = $1 AND project_slug = $2 AND entity_id = $3
                        ORDER BY created_at DESC
                        LIMIT 1
                        """,
                        rule_id,
                        proj_slug,
                        entity_id,
                    )
                    if existing and existing["status"] == "open":
                        await conn.execute(
                            """
                            UPDATE trend_alerts
                            SET message = $1, metric_value_before = $2, metric_value_after = $3,
                                updated_at = NOW(), details_json = $4::jsonb
                            WHERE id = $5
                            """,
                            message,
                            value_before,
                            value_now,
                            json.dumps(details),
                            existing["id"],
                        )
                        results.append(
                            {"rule_id": str(rule_id), "project_slug": proj_slug, "updated": True}
                        )
                    else:
                        alert_id = uuid4()
                        await conn.execute(
                            """
                            INSERT INTO trend_alerts (
                                id, entity_id, project_slug, rule_id, alert_type, severity,
                                message, metric_value_before, metric_value_after, status, details_json
                            )
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'open', $10::jsonb)
                            """,
                            alert_id,
                            entity_id,
                            proj_slug,
                            rule_id,
                            alert_type,
                            severity,
                            message,
                            value_before,
                            value_now,
                            json.dumps(details),
                        )
                        results.append(
                            {"rule_id": str(rule_id), "project_slug": proj_slug, "created": True}
                        )
            except Exception as e:
                results.append(
                    {
                        "rule_id": str(rule_id),
                        "project_slug": proj_slug,
                        "error": str(e),
                    }
                )

    return results


async def diagnostic_trend_alerts(entity_id: Optional[UUID] = None) -> Dict[str, Any]:
    """
    Return diagnostic info for why trend alerts may not be created: rules count,
    projects per rule, and for each (rule, project) whether metric data exists and current value.
    """
    pool = await get_pool()
    now = datetime.now(timezone.utc)
    out: Dict[str, Any] = {"entity_id": str(entity_id) if entity_id else None, "rules": [], "summary": {}}

    async with pool.acquire() as conn:
        if entity_id:
            rules = await conn.fetch(
                """
                SELECT id, entity_id, project_slug, name, rule_type, metric, threshold_pct, window_days, severity, enabled
                FROM alert_rules
                WHERE enabled = true AND entity_id = $1
                ORDER BY name
                """,
                entity_id,
            )
        else:
            rules = await conn.fetch(
                """
                SELECT id, entity_id, project_slug, name, rule_type, metric, threshold_pct, window_days, severity, enabled
                FROM alert_rules
                WHERE enabled = true
                ORDER BY entity_id, name
                """
            )

    out["summary"]["enabled_rules_count"] = len(rules)
    if not rules:
        out["summary"]["message"] = "No enabled alert rules in the database. Create rules on the Intelligent Alerts & Trends page."
        return out

    for rule in rules:
        rid = rule["id"]
        eid = rule["entity_id"]
        project_slug = rule["project_slug"]
        name = rule["name"]
        rule_type = rule["rule_type"]
        metric = rule["metric"]
        threshold_pct = float(rule["threshold_pct"] or 0)
        projects = await _get_project_ids_for_entity(pool, eid, project_slug)
        rule_diag: Dict[str, Any] = {
            "rule_id": str(rid),
            "name": name,
            "rule_type": rule_type,
            "metric": metric,
            "threshold_pct": threshold_pct,
            "project_scope": project_slug or "all projects",
            "projects_count": len(projects),
            "projects": [],
        }
        for proj_slug, proj_name in projects[:10]:  # limit to first 10 projects per rule
            async with pool.acquire() as c2:
                cvh = await c2.fetchval(
                    """
                    SELECT COUNT(*) FROM control_values_history
                    WHERE entity_id = $1 AND project_slug = $2
                    """,
                    eid,
                    proj_slug,
                )
                prov = await c2.fetchval(
                    """
                    SELECT COUNT(*) FROM provenance_evaluations
                    WHERE entity_id = $1 AND project_slug = $2
                    """,
                    eid,
                    proj_slug,
                )
            value_now = await _get_metric_value(pool, eid, proj_slug, metric, now)
            would_fire_threshold = rule_type == "threshold" and value_now is not None and value_now < threshold_pct
            rule_diag["projects"].append({
                "project_slug": proj_slug,
                "control_values_history_rows": cvh or 0,
                "provenance_evaluations_rows": prov or 0,
                "current_metric_value": round(value_now, 2) if value_now is not None else None,
                "would_fire_threshold": would_fire_threshold if rule_type == "threshold" else None,
            })
        if len(projects) > 10:
            rule_diag["projects"].append({"note": f"... and {len(projects) - 10} more projects"})
        out["rules"].append(rule_diag)

    def _has_data(proj: Any) -> bool:
        if not isinstance(proj, dict) or "project_slug" not in proj:
            return False
        return (proj.get("control_values_history_rows") or 0) > 0 or (proj.get("provenance_evaluations_rows") or 0) > 0
    any_data = any(_has_data(p) for r in out["rules"] for p in r["projects"])
    if not any_data:
        out["summary"]["message"] = (
            "No metric data found. Trend alerts need data in control_values_history or provenance_evaluations "
            "for the entity's projects (from scorecard execution and/or provenance evaluations)."
        )
    else:
        out["summary"]["message"] = "Metric data present. Alerts are created when threshold or trend_drop conditions are met."
    return out
