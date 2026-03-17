# app/routers/intelligent_alerts.py
"""Alert rules (threshold / trend_drop) and trend_alerts API."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.db_async import get_pool
from app.dependencies import get_entity_id_with_auth_viewer, get_entity_id_with_auth_editor
from app.services.trend_alerts import compute_trend_alerts, diagnostic_trend_alerts

router = APIRouter(prefix="/scorecard", tags=["intelligent-alerts"])

class PillarItem(BaseModel):
    key: str
    name: str
    weight: float | None = None


@router.get("/pillars")
async def list_pillars(
    entity_id: UUID = Depends(get_entity_id_with_auth_viewer),
) -> dict:
    """List available pillars (from pillars table)."""
    _ = entity_id  # auth scope only
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT key, name, weight
            FROM pillars
            ORDER BY name, key
            """
        )
    return {
        "items": [
            {"key": r["key"], "name": r["name"], "weight": float(r["weight"]) if r["weight"] is not None else None}
            for r in rows
        ]
    }


# ---------- Alert rules ----------
class AlertRuleCreate(BaseModel):
    project_slug: str | None = None
    name: str = Field(..., min_length=1)
    rule_type: str = Field(..., pattern="^(threshold|trend_drop)$")
    metric: str = Field(..., min_length=1)
    threshold_pct: float = Field(..., ge=0, le=100)
    window_days: int | None = Field(None, ge=1, le=365)
    severity: str = Field("medium", pattern="^(high|medium|low)$")
    enabled: bool = True


class AlertRuleUpdate(BaseModel):
    name: str | None = Field(None, min_length=1)
    rule_type: str | None = Field(None, pattern="^(threshold|trend_drop)$")
    metric: str | None = Field(None, min_length=1)
    threshold_pct: float | None = Field(None, ge=0, le=100)
    window_days: int | None = Field(None, ge=1, le=365)
    severity: str | None = Field(None, pattern="^(high|medium|low)$")
    project_slug: str | None = None  # None = all projects
    enabled: bool | None = None


@router.get("/alert-rules")
async def list_alert_rules(
    project_slug: str | None = Query(None),
    entity_id: UUID = Depends(get_entity_id_with_auth_viewer),
) -> dict:
    """List alert rules for the current entity, optionally filtered by project_slug."""
    pool = await get_pool()
    clauses = ["entity_id = $1"]
    params: list = [entity_id]
    if project_slug is not None:
        clauses.append("(project_slug = $2 OR project_slug IS NULL)")
        params.append(project_slug)
    where_sql = " AND ".join(clauses)
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            f"""
            SELECT id, entity_id, project_slug, name, rule_type, metric, threshold_pct,
                   window_days, severity, enabled, created_at, updated_at
            FROM alert_rules
            WHERE {where_sql}
            ORDER BY name
            """,
            *params,
        )
    return {
        "items": [
            {
                "id": str(r["id"]),
                "entity_id": str(r["entity_id"]),
                "project_slug": r["project_slug"],
                "name": r["name"],
                "rule_type": r["rule_type"],
                "metric": r["metric"],
                "threshold_pct": r["threshold_pct"],
                "window_days": r["window_days"],
                "severity": r["severity"],
                "enabled": r["enabled"],
                "created_at": r["created_at"],
                "updated_at": r["updated_at"],
            }
            for r in rows
        ]
    }


@router.post("/alert-rules")
async def create_alert_rule(
    body: AlertRuleCreate,
    entity_id: UUID = Depends(get_entity_id_with_auth_editor),
) -> dict:
    """Create an alert rule for the current entity."""
    if body.rule_type == "trend_drop" and body.window_days is None:
        raise HTTPException(
            status_code=400,
            detail="window_days is required for rule_type trend_drop",
        )
    from uuid import uuid4

    rule_id = uuid4()
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO alert_rules (
                id, entity_id, project_slug, name, rule_type, metric,
                threshold_pct, window_days, severity, enabled
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            """,
            rule_id,
            entity_id,
            body.project_slug,
            body.name,
            body.rule_type,
            body.metric,
            body.threshold_pct,
            body.window_days,
            body.severity,
            body.enabled,
        )
        row = await conn.fetchrow(
            """
            SELECT id, entity_id, project_slug, name, rule_type, metric, threshold_pct,
                   window_days, severity, enabled, created_at, updated_at
            FROM alert_rules WHERE id = $1
            """,
            rule_id,
        )
    return {
        "id": str(row["id"]),
        "entity_id": str(row["entity_id"]),
        "project_slug": row["project_slug"],
        "name": row["name"],
        "rule_type": row["rule_type"],
        "metric": row["metric"],
        "threshold_pct": row["threshold_pct"],
        "window_days": row["window_days"],
        "severity": row["severity"],
        "enabled": row["enabled"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


@router.patch("/alert-rules/{rule_id}")
async def update_alert_rule(
    rule_id: UUID,
    body: AlertRuleUpdate,
    entity_id: UUID = Depends(get_entity_id_with_auth_editor),
) -> dict:
    """Update an alert rule. Rule must belong to the current entity."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id FROM alert_rules WHERE id = $1 AND entity_id = $2",
            rule_id,
            entity_id,
        )
        if not row:
            raise HTTPException(status_code=404, detail="Alert rule not found")
        updates = []
        params: list = []
        idx = 1
        if body.name is not None:
            updates.append(f"name = ${idx}")
            params.append(body.name)
            idx += 1
        if body.rule_type is not None:
            updates.append(f"rule_type = ${idx}")
            params.append(body.rule_type)
            idx += 1
        if body.metric is not None:
            updates.append(f"metric = ${idx}")
            params.append(body.metric)
            idx += 1
        if body.threshold_pct is not None:
            updates.append(f"threshold_pct = ${idx}")
            params.append(body.threshold_pct)
            idx += 1
        if body.window_days is not None:
            updates.append(f"window_days = ${idx}")
            params.append(body.window_days)
            idx += 1
        if body.severity is not None:
            updates.append(f"severity = ${idx}")
            params.append(body.severity)
            idx += 1
        if "project_slug" in body.model_fields_set:
            updates.append(f"project_slug = ${idx}")
            params.append(body.project_slug if body.project_slug else None)
            idx += 1
        if body.enabled is not None:
            updates.append(f"enabled = ${idx}")
            params.append(body.enabled)
            idx += 1
        if not updates:
            row = await conn.fetchrow(
                """
                SELECT id, entity_id, project_slug, name, rule_type, metric, threshold_pct,
                       window_days, severity, enabled, created_at, updated_at
                FROM alert_rules WHERE id = $1
                """,
                rule_id,
            )
            return {k: (str(v) if isinstance(v, UUID) else v) for k, v in row.items()}
        updates.append("updated_at = NOW()")
        n = len(params)
        params.extend([rule_id, entity_id])
        await conn.execute(
            f"UPDATE alert_rules SET {', '.join(updates)} WHERE id = ${n+1} AND entity_id = ${n+2}",
            *params,
        )
        row = await conn.fetchrow(
            """
            SELECT id, entity_id, project_slug, name, rule_type, metric, threshold_pct,
                   window_days, severity, enabled, created_at, updated_at
            FROM alert_rules WHERE id = $1
            """,
            rule_id,
        )
    return {k: (str(v) if isinstance(v, UUID) else v) for k, v in row.items()}


@router.delete("/alert-rules/{rule_id}")
async def delete_alert_rule(
    rule_id: UUID,
    entity_id: UUID = Depends(get_entity_id_with_auth_editor),
) -> dict:
    """Delete an alert rule. Trend alerts linked to it will have rule_id set to NULL."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        r = await conn.execute(
            "DELETE FROM alert_rules WHERE id = $1 AND entity_id = $2",
            rule_id,
            entity_id,
        )
    if r == "DELETE 0":
        raise HTTPException(status_code=404, detail="Alert rule not found")
    return {"ok": True}


# ---------- Trend alerts ----------
@router.get("/trend-alerts")
async def list_trend_alerts(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    project_slug: str | None = Query(None),
    status: str | None = Query(None, pattern="^(open|resolved)$"),
    entity_id: UUID = Depends(get_entity_id_with_auth_viewer),
) -> dict:
    """List trend alerts for the current entity with pagination and filters."""
    pool = await get_pool()
    clauses = ["entity_id = $1"]
    params: list = [entity_id]
    if project_slug is not None:
        params.append(project_slug)
        clauses.append(f"project_slug = ${len(params)}")
    if status is not None:
        params.append(status)
        clauses.append(f"status = ${len(params)}")
    where_sql = " AND ".join(clauses)
    n = len(params)
    async with pool.acquire() as conn:
        total = await conn.fetchval(
            f"SELECT COUNT(*) FROM trend_alerts WHERE {where_sql}",
            *params,
        )
        rows = await conn.fetch(
            f"""
            SELECT id, entity_id, project_slug, rule_id, alert_type, severity, message,
                   metric_value_before, metric_value_after, status, created_at, updated_at,
                   resolved_at, details_json
            FROM trend_alerts
            WHERE {where_sql}
            ORDER BY created_at DESC
            LIMIT ${n+1} OFFSET ${n+2}
            """,
            *params,
            limit,
            offset,
        )
    return {
        "items": [
            {
                "id": str(r["id"]),
                "entity_id": str(r["entity_id"]),
                "project_slug": r["project_slug"],
                "rule_id": str(r["rule_id"]) if r["rule_id"] else None,
                "alert_type": r["alert_type"],
                "severity": r["severity"],
                "message": r["message"],
                "metric_value_before": r["metric_value_before"],
                "metric_value_after": r["metric_value_after"],
                "status": r["status"],
                "created_at": r["created_at"],
                "updated_at": r["updated_at"],
                "resolved_at": r["resolved_at"],
                "details_json": r["details_json"],
            }
            for r in rows
        ],
        "total": int(total or 0),
    }


@router.post("/trend-alerts/{alert_id}/resolve")
async def resolve_trend_alert(
    alert_id: UUID,
    entity_id: UUID = Depends(get_entity_id_with_auth_editor),
) -> dict:
    """Mark a trend alert as resolved."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        r = await conn.execute(
            """
            UPDATE trend_alerts
            SET status = 'resolved', resolved_at = NOW(), updated_at = NOW()
            WHERE id = $1 AND entity_id = $2
            """,
            alert_id,
            entity_id,
        )
    if r == "UPDATE 0":
        raise HTTPException(status_code=404, detail="Trend alert not found")
    return {"ok": True}


@router.get("/trend-alerts/diagnostic")
async def get_trend_alerts_diagnostic(
    entity_id: UUID = Depends(get_entity_id_with_auth_viewer),
) -> dict:
    """Diagnose why trend alerts may not be created: rules, projects, and metric data presence."""
    return await diagnostic_trend_alerts(entity_id)


@router.post("/trend-alerts:compute")
async def compute_trend_alerts_now(
    entity_id: UUID = Depends(get_entity_id_with_auth_editor),
) -> dict:
    """Trigger trend-alert evaluation once (all entities). For testing/admin."""
    results = await compute_trend_alerts()
    return {"count": len(results), "items": results}
