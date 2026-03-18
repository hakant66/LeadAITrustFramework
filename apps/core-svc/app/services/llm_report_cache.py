"""
LLM Report Cache Service

Handles caching and batch processing of LLM-generated reports.
"""
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone, timedelta
from typing import Optional
from uuid import UUID
from psycopg.rows import dict_row
import psycopg
import os
from dotenv import load_dotenv

from app.db_utils import normalize_pg_dsn
from app.services.ai_project_report import KpiRow

load_dotenv()

DB_URL = normalize_pg_dsn(
    os.getenv("DATABASE_URL", "postgresql://leadai:leadai@localhost:5432/leadai")
)


def get_conn() -> psycopg.Connection:
    return psycopg.connect(DB_URL, autocommit=False)


def compute_data_hash(kpi_rows: list[KpiRow], pillar_scores: dict[str, float], overall_score: float | None) -> str:
    """
    Compute a hash of the KPI data to detect when reports need regeneration.
    """
    data = {
        "kpis": [
            {
                "pillar": k.pillar,
                "kpi_key": k.kpi_key,
                "kpi_score": k.kpi_score,
                "current_value": k.current_value,
            }
            for k in kpi_rows
        ],
        "pillar_scores": pillar_scores,
        "overall_score": overall_score,
    }
    data_str = json.dumps(data, sort_keys=True)
    return hashlib.sha256(data_str.encode()).hexdigest()


def get_cached_report(
    project_slug: str,
    provider: str,
    data_hash: str,
    report_type: str = "ai_summary_llm",
    cache_ttl_hours: Optional[int] = None,
    entity_id: Optional[UUID] = None,
) -> Optional[dict]:
    """
    Retrieve a cached LLM report if it exists and is still valid.
    
    Args:
        project_slug: Project identifier
        provider: LLM provider (ollama/openai)
        data_hash: Hash of current KPI data
        cache_ttl_hours: Optional TTL override (None = no expiration)
        entity_id: Optional entity ID for multi-entity filtering
    
    Returns:
        Cached report dict or None if not found/invalid
    """
    with get_conn() as conn, conn.cursor(row_factory=dict_row) as cur:
        sql = """
            SELECT 
                report_md,
                pillar_scores,
                overall_score,
                provider,
                model,
                latency_ms,
                generated_at,
                data_hash,
                expires_at
            FROM llm_report_cache
            WHERE project_slug = %s
              AND provider = %s
              AND report_type = %s
              AND data_hash = %s
        """
        params = [project_slug, provider, report_type, data_hash]
        
        if entity_id:
            sql += " AND entity_id = %s"
            params.append(str(entity_id))
        
        if cache_ttl_hours is not None:
            sql += " AND (expires_at IS NULL OR expires_at > NOW())"
        
        cur.execute(sql, tuple(params))
        row = cur.fetchone()
        
        if row:
            return dict(row)
        return None


def save_cached_report(
    project_slug: str,
    provider: str,
    model: str,
    report_md: str,
    pillar_scores: dict[str, float],
    overall_score: float | None,
    latency_ms: int,
    data_hash: str,
    report_type: str = "ai_summary_llm",
    cache_ttl_hours: Optional[int] = None,
    entity_id: Optional[UUID] = None,
) -> None:
    """
    Save a generated LLM report to the cache.
    
    Args:
        project_slug: Project identifier
        provider: LLM provider
        model: Model name used
        report_md: Generated markdown report
        pillar_scores: Pillar scores dict
        overall_score: Overall score
        latency_ms: Generation latency
        data_hash: Hash of KPI data
        cache_ttl_hours: Optional TTL in hours (None = no expiration)
        entity_id: Optional entity ID for multi-entity support
    """
    expires_at = None
    if cache_ttl_hours is not None:
        expires_at = datetime.now(timezone.utc) + timedelta(hours=cache_ttl_hours)
    
    if entity_id is None:
        raise ValueError("entity_id is required for llm_report_cache entries")

    with get_conn() as conn, conn.cursor() as cur:
        sql = """
            INSERT INTO llm_report_cache (
                entity_id, project_slug, provider, report_type, model, report_md,
                pillar_scores, overall_score, latency_ms,
                data_hash, generated_at, expires_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), %s)
            ON CONFLICT (entity_id, project_slug, provider, report_type)
            DO UPDATE SET
                model = EXCLUDED.model,
                report_md = EXCLUDED.report_md,
                pillar_scores = EXCLUDED.pillar_scores,
                overall_score = EXCLUDED.overall_score,
                latency_ms = EXCLUDED.latency_ms,
                data_hash = EXCLUDED.data_hash,
                generated_at = EXCLUDED.generated_at,
                expires_at = EXCLUDED.expires_at
        """
        cur.execute(
            sql,
            (
                str(entity_id),
                project_slug,
                provider,
                report_type,
                model,
                report_md,
                json.dumps(pillar_scores),
                overall_score,
                latency_ms,
                data_hash,
                expires_at,
            ),
        )
        conn.commit()


def invalidate_cache(
    project_slug: Optional[str] = None,
    report_type: Optional[str] = None,
) -> int:
    """
    Invalidate cached reports for a project or all projects.
    
    Args:
        project_slug: If provided, invalidate only this project. Otherwise invalidate all.
    
    Returns:
        Number of rows deleted
    """
    with get_conn() as conn, conn.cursor() as cur:
        if project_slug:
            if report_type:
                cur.execute(
                    "DELETE FROM llm_report_cache WHERE project_slug = %s AND report_type = %s",
                    (project_slug, report_type),
                )
            else:
                cur.execute(
                    "DELETE FROM llm_report_cache WHERE project_slug = %s",
                    (project_slug,),
                )
        else:
            if report_type:
                cur.execute(
                    "DELETE FROM llm_report_cache WHERE report_type = %s",
                    (report_type,),
                )
            else:
                cur.execute("DELETE FROM llm_report_cache")
        deleted = cur.rowcount
        conn.commit()
        return deleted


async def invalidate_cache_async(
    project_slug: Optional[str] = None,
    report_type: Optional[str] = None,
) -> int:
    """
    Async version of invalidate_cache for use in async endpoints.
    """
    from app.db_async import get_pool
    
    pool = await get_pool()
    async with pool.acquire() as conn:
        if project_slug:
            if report_type:
                deleted = await conn.execute(
                    "DELETE FROM llm_report_cache WHERE project_slug = $1 AND report_type = $2",
                    project_slug,
                    report_type,
                )
            else:
                deleted = await conn.execute(
                    "DELETE FROM llm_report_cache WHERE project_slug = $1",
                    project_slug,
                )
        else:
            if report_type:
                deleted = await conn.execute(
                    "DELETE FROM llm_report_cache WHERE report_type = $1",
                    report_type,
                )
            else:
                deleted = await conn.execute("DELETE FROM llm_report_cache")
        # Extract number from result string like "DELETE 5"
        try:
            return int(deleted.split()[-1]) if deleted else 0
        except (ValueError, IndexError):
            return 0


def get_projects_needing_reports(
    provider: str = "ollama",
    entity_id: Optional[UUID] = None,
    report_type: str = "ai_summary_llm",
) -> list[dict]:
    """
    Get list of projects that need LLM reports generated.
    Returns projects that either:
    1. Don't have a cached report
    2. Have expired cache entries
    3. Have data_hash mismatches (KPI data changed)
    
    Args:
        provider: LLM provider name
        entity_id: Optional entity ID to filter projects by entity
    """
    with get_conn() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Get all projects with their current KPI data hashes
        sql = """
            WITH project_kpis AS (
                SELECT DISTINCT cv.project_slug
                FROM control_values cv
                WHERE cv.project_slug IS NOT NULL
        """
        params = []
        
        if entity_id:
            sql += """
                AND cv.entity_id = %s
            """
            params.append(str(entity_id))
        
        sql += """
            ),
            project_data AS (
                SELECT 
                    p.slug AS project_slug,
                    p.name AS project_name,
                    COUNT(*) AS kpi_count
                FROM entity_projects p
                JOIN control_values cv ON cv.project_slug = p.slug
        """
        
        if entity_id:
            sql += """
                WHERE p.entity_id = %s AND cv.entity_id = %s
            """
            params.append(str(entity_id))
            params.append(str(entity_id))
        
        sql += """
                GROUP BY p.slug, p.name
            )
            SELECT 
                pd.project_slug,
                pd.project_name,
                pd.kpi_count,
                c.data_hash AS cached_hash,
                c.expires_at,
                CASE 
                    WHEN c.project_slug IS NULL THEN true
                    WHEN c.expires_at IS NOT NULL AND c.expires_at < NOW() THEN true
                    ELSE false
                END AS needs_regeneration
            FROM project_data pd
            LEFT JOIN llm_report_cache c ON c.project_slug = pd.project_slug 
                AND c.provider = %s
                AND c.report_type = %s
        """
        params.append(provider)
        params.append(report_type)
        
        if entity_id:
            sql += """
                AND c.entity_id = %s
            """
            params.append(str(entity_id))
        
        sql += """
            WHERE pd.kpi_count > 0
            ORDER BY pd.project_slug
        """
        
        cur.execute(sql, tuple(params))
        return cur.fetchall()


def cleanup_expired_cache() -> int:
    """
    Remove expired cache entries.
    
    Returns:
        Number of rows deleted
    """
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("DELETE FROM llm_report_cache WHERE expires_at IS NOT NULL AND expires_at < NOW()")
        deleted = cur.rowcount
        conn.commit()
        return deleted
