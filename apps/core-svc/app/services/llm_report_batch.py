"""
LLM Report Batch Processing Service

Generates LLM reports in batch for all projects that need them.
"""
from __future__ import annotations

import os
import hashlib
import json
from typing import Optional
from uuid import UUID
from psycopg.rows import dict_row
import psycopg
from dotenv import load_dotenv

from app.db_utils import normalize_pg_dsn
from app.routers.ai_reports import (
    get_active_prompt_optional,
    _apply_prompt_vars,
    _build_executive_report_vars,
    _format_kpi_table,
    _summarize_sources,
    _load_active_prompt,
    _compute_governance_requirements_hash,
    _compute_board_level_hash,
)
from app.services.ai_project_report import KpiRow
from app.services.llm import generate_text, LLMError
from app.services.llm_report_cache import (
    get_conn,
    compute_data_hash,
    save_cached_report,
    get_projects_needing_reports,
    get_cached_report,
)

load_dotenv()

DB_URL = normalize_pg_dsn(
    os.getenv("DATABASE_URL", "postgresql://leadai:leadai@localhost:5432/leadai")
)


def compute_pillar_scores(kpis: list[KpiRow]) -> dict[str, float]:
    """
    Aggregate KPI scores by pillar for the JSON response.
    Ignores None scores.
    """
    buckets: dict[str, list[float]] = {}

    for row in kpis:
        if row.kpi_score is None:
            continue
            
        pillar = row.pillar or "Unassigned"
        buckets.setdefault(pillar, []).append(float(row.kpi_score))

    scores: dict[str, float] = {}
    for pillar, values in buckets.items():
        if not values:
            continue
        scores[pillar] = sum(values) / len(values)

    return scores


def compute_overall_score(pillar_scores: dict[str, float]) -> float | None:
    if not pillar_scores:
        return None
    vals = list(pillar_scores.values())
    return sum(vals) / len(vals)


def _score_band(score: float) -> str:
    if score >= 80:
        return "Strong"
    if score >= 60:
        return "Moderate"
    if score >= 40:
        return "Weak"
    return "Critical"


def build_llm_prompt(
    project_name: str,
    project_slug: str,
    kpis: list[KpiRow],
    pillar_scores: dict[str, float],
    overall_score: float | None,
) -> str:
    weak_kpis = sorted(
        [k for k in kpis if k.kpi_score is not None],
        key=lambda k: k.kpi_score,
    )[:10]

    pillar_lines = [
        f"- {pillar}: {score:.1f}% ({_score_band(score)})"
        for pillar, score in sorted(pillar_scores.items(), key=lambda x: x[1])
    ]
    weak_kpi_lines = [
        f"- {k.pillar} | {k.kpi_name} ({k.kpi_key}) = {k.kpi_score:.1f}% | Owner: {k.owner or 'Unassigned'}"
        for k in weak_kpis
    ]

    return "\n".join(
        [
            "You are a senior AI governance consultant producing an executive report in McKinsey & Company style.",
            "The report must be precise, data-driven, and action-oriented with clear accountability.",
            "",
            "REPORT STRUCTURE (use exact Markdown headings):",
            "",
            "# Executive Report: [Project Name]",
            "",
            "## Executive Summary",
            "- Provide a concise 2-3 sentence overview of the project's AI governance posture",
            "- State the overall trust score and key risk areas",
            "- Highlight the most critical governance gaps",
            "",
            "## Key Findings",
            "- List 3-5 critical findings based on pillar scores and KPI performance",
            "- Each finding should be data-backed (cite specific scores/metrics)",
            "- Use bullet points with clear, concise statements",
            "",
            "## Prioritized Action Plan",
            "- Present actions in a structured table format:",
            "  | Priority | Action | Owner | Due Date | Status |",
            "  |----------|--------|-------|----------|--------|",
            "- Priority: Critical / High / Medium / Low",
            "- Action: Specific, measurable action item",
            "- Owner: Assign based on KPI owner_role when available, else suggest appropriate role (e.g., 'Data Governance Lead', 'AI Risk Manager', 'Compliance Officer')",
            "- Due Date: Suggest realistic dates (e.g., '2026-03-15' for critical items within 30 days, '2026-04-30' for high priority within 60 days, '2026-06-30' for medium within 90 days)",
            "- Status: 'Not Started' for all new actions",
            "- Focus on the lowest-scoring pillars and KPIs",
            "- Include 5-8 action items total",
            "",
            "## Next Steps",
            "- List 3-4 immediate next steps (next 2 weeks)",
            "- Each step should have:",
            "  - Specific action",
            "  - Accountable role/profile",
            "  - Target completion date",
            "",
            "## Risk Summary by Pillar",
            "- For each pillar, provide:",
            "  - Current score and status",
            "  - Key risks identified",
            "  - Impact if not addressed",
            "",
            "STYLE REQUIREMENTS:",
            "- Use professional, executive-level language",
            "- Be precise and data-driven (cite specific percentages and metrics)",
            "- Avoid vague statements; use concrete facts",
            "- Format tables cleanly with proper Markdown",
            "- Use bullet points for lists",
            "- Keep paragraphs concise (2-3 sentences max)",
            "- Do not invent metrics or data not provided",
            "- If data is missing, state 'Data not available' rather than guessing",
            "",
            "PROJECT DATA:",
            f"Project Name: {project_name}",
            f"Project Slug: {project_slug}",
            f"Overall Trust Score: {overall_score:.1f}%" if overall_score is not None else "Overall Trust Score: N/A",
            "",
            "Pillar Performance:",
            *pillar_lines,
            "",
            "Lowest-Performing KPIs (require immediate attention):",
            *(weak_kpi_lines if weak_kpi_lines else ["- No KPI scores available"]),
            "",
            "Generate the report now following the structure above:",
        ]
    )


def fetch_project_kpis(project_slug: str) -> tuple[Optional[dict], list[KpiRow]]:
    """
    Fetch project metadata and KPI rows for a project.
    
    Returns:
        (project_dict, list of KpiRow) or (None, []) if project not found
    """
    sql_proj = """
      SELECT slug, name
      FROM public.entity_projects
      WHERE slug = %s
      LIMIT 1;
    """

    sql_kpis = """
      SELECT
        pl.name         AS pillar,
        k.name          AS kpi_name,
        k.key           AS kpi_key,
        COALESCE(cv.target_text, c.target_text) AS target,
        cv.current_value,
        cv.kpi_score,
        cv.evidence_source AS evidence,
        cv.owner_role      AS owner,
        to_char(cv.observed_at, 'YYYY-MM-DD') AS "date"
      FROM public.control_values cv
      JOIN public.controls c      ON c.id = cv.control_id
      JOIN public.kpis k          ON k.key = cv.kpi_key
      JOIN public.pillars pl      ON pl.id = k.pillar_id
      WHERE cv.project_slug = %s;
    """

    with get_conn() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(sql_proj, (project_slug,))
        proj = cur.fetchone()
        if not proj:
            return None, []

        cur.execute(sql_kpis, (project_slug,))
        rows = cur.fetchall()

    kpi_rows: list[KpiRow] = [
        KpiRow(
            pillar=r["pillar"],
            kpi_name=r["kpi_name"],
            kpi_key=r["kpi_key"],
            target=r["target"],
            current_value=r["current_value"],
            kpi_score=r["kpi_score"],
            evidence=r["evidence"],
            owner=r["owner"],
            date=r["date"] or "",
        )
        for r in rows
    ]

    return dict(proj), kpi_rows


async def generate_report_for_project(
    project_slug: str,
    provider: Optional[str] = None,
    cache_ttl_hours: Optional[int] = None,
    entity_id: Optional[UUID] = None,
) -> dict:
    """
    Generate an LLM report for a single project.
    Uses the same scorecard as the dashboard so overall and pillar scores match.
    
    Returns:
        dict with success status and details
    """
    from app.db_async import get_pool
    from app.scorecard import get_project_out_or_none, load_scorecard, evaluate_project_provenance

    provider_norm = (provider or os.getenv("LLM_PROVIDER", "ollama")).lower()

    try:
        # Use dashboard scorecard as single source of truth (without request Depends)
        pool = await get_pool()
        async with pool.acquire() as conn:
            resolved_entity_id = entity_id
            if resolved_entity_id is None:
                rows = await conn.fetch(
                    "SELECT DISTINCT entity_id FROM entity_projects WHERE slug = $1",
                    project_slug,
                )
                if not rows:
                    return {
                        "project_slug": project_slug,
                        "success": False,
                        "error": "Project not found",
                    }
                if len(rows) > 1:
                    return {
                        "project_slug": project_slug,
                        "success": False,
                        "error": "Project slug is not unique across entities. Please specify entity_id.",
                    }
                resolved_entity_id = rows[0]["entity_id"]

            project = await get_project_out_or_none(conn, project_slug, resolved_entity_id)
            if project is None:
                return {
                    "project_slug": project_slug,
                    "success": False,
                    "error": "Project not found",
                }

            provenance_eval = None
            try:
                provenance_eval = await evaluate_project_provenance(
                    conn,
                    project_slug,
                    entity_id=resolved_entity_id,
                )
            except Exception:
                provenance_eval = None

            scorecard = await load_scorecard(
                conn,
                project_slug,
                project=project,
                provenance_eval=provenance_eval,
                entity_id=resolved_entity_id,
            )

        proj = {"slug": scorecard.project.slug, "name": scorecard.project.name}
        pillar_scores = {p.name: p.score_pct for p in scorecard.pillars}
        overall_score = float(scorecard.overall_pct) if scorecard.overall_pct is not None else None

        kpi_rows: list[KpiRow] = [
            KpiRow(
                pillar=k.pillar or "Unassigned",
                kpi_name=k.name or k.key,
                kpi_key=k.key,
                target=k.target_text or (str(k.target_numeric) if k.target_numeric is not None else None),
                current_value=k.current_value if k.current_value is not None else k.raw_value,
                kpi_score=k.kpi_score,
                evidence=k.evidence_source,
                owner=k.owner_role or k.owner,
                date=k.as_of.strftime("%Y-%m-%d") if k.as_of and getattr(k.as_of, "strftime", None) else "",
            )
            for k in (scorecard.kpis or [])
        ]

        # Check if we need to regenerate (data hash changed)
        data_hash = compute_data_hash(kpi_rows, pillar_scores, overall_score)
        
        # Get entity_id from project if not provided
        effective_entity_id = resolved_entity_id

        # Check cache first - skip generation if cache is valid
        cached = get_cached_report(
            project_slug=project_slug,
            provider=provider_norm,
            data_hash=data_hash,
            report_type="ai_summary_llm",
            cache_ttl_hours=cache_ttl_hours,
            entity_id=effective_entity_id,
        )
        if cached:
            return {
                "project_slug": project_slug,
                "success": True,
                "cached": True,
                "provider": cached["provider"],
                "model": cached["model"],
                "latency_ms": cached["latency_ms"],
            }
        
        # Build prompt from DB/Langfuse template if present, else fallback to hardcoded
        vars = _build_executive_report_vars(
            project_name=proj["name"] or proj["slug"],
            project_slug=proj["slug"],
            kpis=kpi_rows,
            pillar_scores=pillar_scores,
            overall_score=overall_score,
        )
        prompt_row = await get_active_prompt_optional("ai_summary_llm", vars)
        prompt_meta = None
        if prompt_row:
            if prompt_row.get("source") == "langfuse":
                prompt = prompt_row["prompt_text"]
            else:
                prompt = _apply_prompt_vars(prompt_row["prompt_text"], vars)
            prompt_meta = {
                "prompt_key": prompt_row.get("key"),
                "prompt_name": prompt_row.get("name"),
                "prompt_version": prompt_row.get("version"),
                "prompt_source": prompt_row.get("source", "db"),
                "prompt_label": prompt_row.get("label"),
            }
        else:
            prompt = build_llm_prompt(
                project_name=proj["name"],
                project_slug=proj["slug"],
                kpis=kpi_rows,
                pillar_scores=pillar_scores,
                overall_score=overall_score,
            )

        try:
            trace_meta = {
                "project_slug": proj["slug"],
                "project_name": proj["name"],
                "entity_id": str(effective_entity_id) if effective_entity_id else None,
                "report_type": "ai_summary_llm",
            }
            llm_resp = generate_text(
                prompt,
                provider=provider_norm,
                trace_name="ai_summary_llm",
                trace_metadata=trace_meta,
                prompt_metadata=prompt_meta,
            )
        except LLMError as exc:
            return {
                "project_slug": project_slug,
                "success": False,
                "error": f"LLM generation failed: {exc}",
            }

        # Save to cache
        save_cached_report(
            project_slug=proj["slug"],
            provider=llm_resp.provider,
            model=llm_resp.model,
            report_md=llm_resp.text,
            pillar_scores=pillar_scores,
            overall_score=overall_score,
            latency_ms=llm_resp.latency_ms,
            data_hash=data_hash,
            report_type="ai_summary_llm",
            cache_ttl_hours=cache_ttl_hours,
            entity_id=effective_entity_id,
        )

        return {
            "project_slug": project_slug,
            "success": True,
            "provider": llm_resp.provider,
            "model": llm_resp.model,
            "latency_ms": llm_resp.latency_ms,
        }

    except Exception as exc:
        return {
            "project_slug": project_slug,
            "success": False,
            "error": str(exc),
        }


async def generate_governance_report_for_project(
    project_slug: str,
    provider: Optional[str] = None,
    cache_ttl_hours: Optional[int] = None,
    entity_id: Optional[UUID] = None,
) -> dict:
    """
    Generate a Governance Requirements report for a single project.
    """
    from app.db_async import get_pool
    from app.scorecard import get_project_out_or_none, load_scorecard, evaluate_project_provenance

    provider_norm = (provider or os.getenv("LLM_PROVIDER", "ollama")).lower()

    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            resolved_entity_id = entity_id
            if resolved_entity_id is None:
                rows = await conn.fetch(
                    "SELECT DISTINCT entity_id FROM entity_projects WHERE slug = $1",
                    project_slug,
                )
                if not rows:
                    return {
                        "project_slug": project_slug,
                        "success": False,
                        "error": "Project not found",
                    }
                if len(rows) > 1:
                    return {
                        "project_slug": project_slug,
                        "success": False,
                        "error": "Project slug is not unique across entities. Please specify entity_id.",
                    }
                resolved_entity_id = rows[0]["entity_id"]

            project = await get_project_out_or_none(conn, project_slug, resolved_entity_id)
            if project is None:
                return {
                    "project_slug": project_slug,
                    "success": False,
                    "error": "Project not found",
                }

            provenance_eval = None
            try:
                provenance_eval = await evaluate_project_provenance(
                    conn,
                    project_slug,
                    entity_id=resolved_entity_id,
                )
            except Exception:
                provenance_eval = None

            scorecard = await load_scorecard(
                conn,
                project_slug,
                project=project,
                provenance_eval=provenance_eval,
                entity_id=resolved_entity_id,
            )

            project_name = scorecard.project.name or project_slug

            entity_row = await conn.fetchrow(
                """
                SELECT COALESCE(e.full_legal_name, e.slug) AS entity_name,
                       pr.name AS primary_role,
                       rc.name AS risk_classification
                FROM entity e
                LEFT JOIN entity_primary_role pr ON pr.id = e.primary_role_id
                LEFT JOIN entity_risk_class rc ON rc.id = e.risk_classification_id
                WHERE e.id = $1
                """,
                resolved_entity_id,
            )
            entity_name = entity_row["entity_name"] if entity_row else "Entity"
            primary_role = (
                entity_row["primary_role"] if entity_row and entity_row["primary_role"] else ""
            )
            risk_classification = (
                entity_row["risk_classification"]
                if entity_row and entity_row["risk_classification"]
                else ""
            )

            req_rows = await conn.fetch(
                """
                SELECT framework, requirement_code, uc_id, status
                FROM ai_requirement_register
                WHERE project_slug = $1 AND entity_id = $2
                ORDER BY framework, requirement_code
                """,
                project_slug,
                resolved_entity_id,
            )
            framework_lines = []
            for r in req_rows:
                label = r["framework"]
                code = r["requirement_code"] or "—"
                uc_id = r["uc_id"] or "—"
                status = r["status"] or "—"
                framework_lines.append(
                    f"- {label}: {code} (Use Case: {uc_id}, Status: {status})"
                )

            source_rows = await conn.fetch(
                """
                SELECT title, source_type, content, file_name
                FROM report_sources
                WHERE project_slug IS NULL
                ORDER BY updated_at DESC NULLS LAST, created_at DESC
                LIMIT 8
                """
            )

            kpi_keys = [k.key for k in (scorecard.kpis or []) if k.key]
            kpi_scores = {k.key: k.kpi_score for k in (scorecard.kpis or []) if k.key}
            kpi_map_rows: list[dict] = []
            if kpi_keys:
                rows = await conn.fetch(
                    """
                    SELECT kd.kpi_key,
                           COALESCE(k.name, kd.kpi_name) AS kpi_name,
                           kd.iso_42001_clause,
                           kd.nist_clause,
                           kd.euaiact_clause
                    FROM kpi_definition kd
                    LEFT JOIN kpis k ON k.key = kd.kpi_key
                    WHERE kd.kpi_key = ANY($1::text[])
                    """,
                    kpi_keys,
                )
                for row in rows:
                    kpi_map_rows.append(
                        {
                            "kpi_key": row["kpi_key"],
                            "kpi_name": row["kpi_name"],
                            "kpi_score": kpi_scores.get(row["kpi_key"]),
                            "iso_42001_clause": row["iso_42001_clause"],
                            "nist_clause": row["nist_clause"],
                            "euaiact_clause": row["euaiact_clause"],
                        }
                    )

        framework_hash_rows = [
            {
                "framework": r["framework"],
                "requirement_code": r["requirement_code"],
                "uc_id": r["uc_id"],
                "status": r["status"],
            }
            for r in req_rows
        ]
        kpi_hash_rows = sorted(
            [
                {
                    "kpi_key": row.get("kpi_key"),
                    "kpi_score": row.get("kpi_score"),
                    "iso_42001_clause": row.get("iso_42001_clause"),
                    "nist_clause": row.get("nist_clause"),
                    "euaiact_clause": row.get("euaiact_clause"),
                }
                for row in kpi_map_rows
            ],
            key=lambda item: item.get("kpi_key") or "",
        )
        source_hash_rows = [
            {
                "title": row.get("title"),
                "source_type": row.get("source_type"),
                "file_name": row.get("file_name"),
                "content_hash": hashlib.sha256(
                    (row.get("content") or "").encode()
                ).hexdigest(),
            }
            for row in source_rows
        ]
        data_hash = _compute_governance_requirements_hash(
            {
                "project_slug": project_slug,
                "entity_id": str(resolved_entity_id),
                "primary_role": primary_role,
                "risk_classification": risk_classification,
                "frameworks": framework_hash_rows,
                "kpis": kpi_hash_rows,
                "sources": source_hash_rows,
            }
        )

        cached = get_cached_report(
            project_slug=project_slug,
            provider=provider_norm,
            data_hash=data_hash,
            report_type="governance_requirements_report",
            cache_ttl_hours=cache_ttl_hours,
            entity_id=resolved_entity_id,
        )
        if cached:
            return {
                "project_slug": project_slug,
                "success": True,
                "cached": True,
                "provider": cached["provider"],
                "model": cached["model"],
                "latency_ms": cached["latency_ms"],
                "report_type": "governance_requirements_report",
            }

        prompt_key = "governance_requirements_report"
        prompt_row = await _load_active_prompt(prompt_key)
        prompt_text = prompt_row["prompt_text"]

        prompt = _apply_prompt_vars(
            prompt_text,
            {
                "Project Name": project_name,
                "Entity Name": entity_name,
                "Primary Role": primary_role,
                "Risk Classification": risk_classification,
            },
        )
        if framework_lines:
            prompt += "\n\nChosen Governance Frameworks:\n" + "\n".join(framework_lines)
        else:
            prompt += "\n\nChosen Governance Frameworks:\n- None selected"

        prompt += "\n\nKPI Performance Dashboard:\n" + _format_kpi_table(kpi_map_rows)
        prompt += "\n\nKnowledge Vault Sources:\n" + _summarize_sources(
            [dict(r) for r in source_rows]
        )

        try:
            llm_resp = generate_text(
                prompt,
                provider=provider_norm,
                model=None,
                temperature=0.2,
                trace_name="governance_requirements_report",
                trace_metadata={
                    "project_slug": project_slug,
                    "project_name": project_name,
                    "entity_id": str(resolved_entity_id),
                    "report_type": "governance_requirements_report",
                },
                prompt_metadata={
                    "prompt_key": prompt_row.get("key"),
                    "prompt_name": prompt_row.get("name"),
                    "prompt_version": prompt_row.get("version"),
                    "prompt_source": "db",
                },
            )
        except LLMError as exc:
            return {
                "project_slug": project_slug,
                "success": False,
                "error": f"LLM generation failed: {exc}",
            }

        save_cached_report(
            project_slug=project_slug,
            provider=llm_resp.provider,
            model=llm_resp.model,
            report_md=llm_resp.text,
            pillar_scores={},
            overall_score=None,
            latency_ms=llm_resp.latency_ms,
            data_hash=data_hash,
            report_type="governance_requirements_report",
            cache_ttl_hours=cache_ttl_hours,
            entity_id=resolved_entity_id,
        )

        return {
            "project_slug": project_slug,
            "success": True,
            "provider": llm_resp.provider,
            "model": llm_resp.model,
            "latency_ms": llm_resp.latency_ms,
            "report_type": "governance_requirements_report",
        }
    except Exception as exc:
        return {
            "project_slug": project_slug,
            "success": False,
            "error": str(exc),
            "report_type": "governance_requirements_report",
        }


def get_all_projects(entity_id: Optional[UUID] = None) -> list[dict]:
    """
    Get all projects in the system for batch report generation.
    Returns all projects regardless of cache status.
    Uses the same table as get_projects_needing_reports for consistency.
    
    Args:
        entity_id: Optional entity ID to filter projects by entity
    """
    with get_conn() as conn, conn.cursor(row_factory=dict_row) as cur:
        sql = """
            SELECT DISTINCT 
                p.slug AS project_slug,
                p.name AS project_name
            FROM entity_projects p
            WHERE p.slug IS NOT NULL
        """
        params = []
        
        if entity_id:
            sql += " AND p.entity_id = %s"
            params.append(str(entity_id))
        
        sql += " ORDER BY p.slug"
        
        cur.execute(sql, tuple(params) if params else None)
        return cur.fetchall()


def get_projects_with_requirements(entity_id: Optional[UUID] = None) -> list[dict]:
    """
    Get projects that have requirement register rows.
    """
    with get_conn() as conn, conn.cursor(row_factory=dict_row) as cur:
        sql = """
            SELECT DISTINCT
                r.project_slug AS project_slug,
                p.name AS project_name
            FROM ai_requirement_register r
            JOIN entity_projects p ON p.slug = r.project_slug
            WHERE r.project_slug IS NOT NULL
        """
        params = []
        if entity_id:
            sql += " AND r.entity_id = %s"
            params.append(str(entity_id))
        sql += " ORDER BY r.project_slug"
        cur.execute(sql, tuple(params) if params else None)
        return cur.fetchall()


def get_all_entity_ids() -> list[UUID]:
    with get_conn() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute("SELECT id FROM entity ORDER BY id")
        rows = cur.fetchall()
        entity_ids: list[UUID] = []
        for r in rows:
            value = r["id"]
            if isinstance(value, UUID):
                entity_ids.append(value)
            else:
                entity_ids.append(UUID(str(value)))
        return entity_ids


async def generate_board_level_report_for_entity(
    entity_id: UUID,
    provider: Optional[str] = None,
    cache_ttl_hours: Optional[int] = None,
) -> dict:
    """
    Generate a board-level summary report for a single entity.
    """
    from app.db_async import get_pool

    provider_norm = (provider or os.getenv("LLM_PROVIDER", "openai")).lower()

    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            entity_row = await conn.fetchrow(
                """
                SELECT e.slug,
                       COALESCE(e.full_legal_name, e.slug) AS entity_name,
                       pr.name AS primary_role,
                       rc.name AS risk_classification
                FROM entity e
                LEFT JOIN entity_primary_role pr ON pr.id = e.primary_role_id
                LEFT JOIN entity_risk_class rc ON rc.id = e.risk_classification_id
                WHERE e.id = $1
                """,
                entity_id,
            )
            if not entity_row:
                return {
                    "entity_id": str(entity_id),
                    "success": False,
                    "error": "Entity not found",
                }

            entity_slug = entity_row["slug"]
            entity_name = entity_row["entity_name"]
            primary_role = entity_row["primary_role"] or "—"
            risk_classification = entity_row["risk_classification"] or "—"

            project_rows = await conn.fetch(
                """
                SELECT slug, name, status, risk_level, priority, update_date
                FROM entity_projects
                WHERE entity_id = $1 AND (is_archived IS NULL OR is_archived = false)
                ORDER BY name
                """,
                entity_id,
            )
            project_list = [
                {
                    "slug": r["slug"],
                    "name": r["name"],
                    "status": r["status"],
                    "risk_level": r["risk_level"],
                    "priority": r["priority"],
                    "updated_at": r["update_date"].isoformat() if r["update_date"] else None,
                }
                for r in project_rows
            ]
            project_slugs = [r["slug"] for r in project_rows]

            ai_system_rows = await conn.fetch(
                """
                SELECT id, name, project_slug, model_provider, model_type, model_version,
                       risk_tier, status, lifecycle_stage
                FROM ai_system_registry
                WHERE entity_id = $1
                ORDER BY name
                """,
                entity_id,
            )
            ai_system_list = [
                {
                    "id": str(r["id"]),
                    "name": r["name"],
                    "project_slug": r["project_slug"],
                    "model_provider": r["model_provider"],
                    "model_type": r["model_type"],
                    "model_version": r["model_version"],
                    "risk_tier": r["risk_tier"],
                    "status": r["status"],
                    "lifecycle_stage": r["lifecycle_stage"],
                }
                for r in ai_system_rows
            ]

            policy_rows = await conn.fetch(
                """
                SELECT policy_title, policy_status, iso42001_requirements,
                       iso42001_status, version_status, updated_at
                FROM entity_policy_register
                WHERE entity_id = $1
                ORDER BY policy_title
                """,
                entity_id,
            )
            policy_list = [
                {
                    "policy_title": r["policy_title"],
                    "policy_status": r["policy_status"],
                    "iso42001_requirements": r["iso42001_requirements"],
                    "iso42001_status": r["iso42001_status"],
                    "version_status": r["version_status"],
                    "updated_at": r["updated_at"].isoformat() if r["updated_at"] else None,
                }
                for r in policy_rows
            ]

            policy_status_counts = await conn.fetch(
                """
                SELECT policy_status, COUNT(*) AS count
                FROM entity_policy_register
                WHERE entity_id = $1
                GROUP BY policy_status
                """,
                entity_id,
            )
            policy_version_counts = await conn.fetch(
                """
                SELECT version_status, COUNT(*) AS count
                FROM entity_policy_register
                WHERE entity_id = $1
                GROUP BY version_status
                """,
                entity_id,
            )
            policy_review_counts = await conn.fetch(
                """
                SELECT status, COUNT(*) AS count
                FROM policy_review_tasks
                WHERE entity_id = $1
                GROUP BY status
                """,
                entity_id,
            )
            policy_review_overdue = await conn.fetchval(
                """
                SELECT COUNT(*)
                FROM policy_review_tasks
                WHERE entity_id = $1
                  AND status != 'completed'
                  AND due_at < NOW()
                """,
                entity_id,
            )
            policy_review_due_soon = await conn.fetchval(
                """
                SELECT COUNT(*)
                FROM policy_review_tasks
                WHERE entity_id = $1
                  AND status != 'completed'
                  AND due_at <= NOW() + INTERVAL '30 days'
                """,
                entity_id,
            )

            policy_alert_counts = []
            if project_slugs:
                policy_alert_counts = await conn.fetch(
                    """
                    SELECT status, severity, COUNT(*) AS count
                    FROM policy_alerts
                    WHERE project_slug = ANY($1::text[])
                       OR project_slug IS NULL
                       OR project_slug = 'global'
                    GROUP BY status, severity
                    """,
                    project_slugs,
                )

            control_summary = await conn.fetchrow(
                """
                SELECT
                    COUNT(*) AS total_controls,
                    SUM(CASE WHEN e.designated_owner_email IS NOT NULL THEN 1 ELSE 0 END) AS with_owner_email,
                    SUM(CASE WHEN e.due_date IS NOT NULL THEN 1 ELSE 0 END) AS with_due_date,
                    SUM(CASE WHEN e.provide_url IS NOT NULL OR e.comment_text IS NOT NULL THEN 1 ELSE 0 END) AS with_evidence
                FROM control_values v
                LEFT JOIN control_values_exec e
                  ON e.entity_slug = $2
                 AND e.project_slug = v.project_slug
                 AND e.control_id = v.control_id
                WHERE v.entity_id = $1
                """,
                entity_id,
                entity_slug,
            )

        data_payload = {
            "entity": {
                "entity_id": str(entity_id),
                "entity_slug": entity_slug,
                "entity_name": entity_name,
                "primary_role": primary_role,
                "risk_classification": risk_classification,
            },
            "projects": project_list,
            "ai_systems": ai_system_list,
            "policies": policy_list,
            "policy_status_counts": {
                r["policy_status"]: r["count"] for r in policy_status_counts
            },
            "policy_version_counts": {
                r["version_status"]: r["count"] for r in policy_version_counts
            },
            "policy_review_counts": {
                r["status"]: r["count"] for r in policy_review_counts
            },
            "policy_review_overdue": int(policy_review_overdue or 0),
            "policy_review_due_soon": int(policy_review_due_soon or 0),
            "policy_alert_counts": [
                {"status": r["status"], "severity": r["severity"], "count": r["count"]}
                for r in policy_alert_counts
            ],
            "controls": {
                "total_controls": int(control_summary["total_controls"] or 0)
                if control_summary
                else 0,
                "with_owner_email": int(control_summary["with_owner_email"] or 0)
                if control_summary
                else 0,
                "with_due_date": int(control_summary["with_due_date"] or 0)
                if control_summary
                else 0,
                "with_evidence": int(control_summary["with_evidence"] or 0)
                if control_summary
                else 0,
            },
        }

        data_hash = _compute_board_level_hash(data_payload)
        cached = get_cached_report(
            project_slug="__entity__",
            provider=provider_norm,
            data_hash=data_hash,
            report_type="board_level_report",
            cache_ttl_hours=cache_ttl_hours,
            entity_id=entity_id,
        )
        if cached:
            return {
                "entity_id": str(entity_id),
                "success": True,
                "cached": True,
                "provider": cached["provider"],
                "model": cached["model"],
                "latency_ms": cached["latency_ms"],
                "report_type": "board_level_report",
            }

        prompt_key = "board-level-report"
        prompt_row = await _load_active_prompt(prompt_key)
        prompt_text = prompt_row["prompt_text"]
        prompt = _apply_prompt_vars(
            prompt_text,
            {
                "Entity Name": entity_name,
                "Entity Slug": entity_slug,
                "Primary Role": primary_role,
                "Risk Classification": risk_classification,
            },
        )
        prompt += "\n\nENTITY DATA (JSON):\n" + json.dumps(data_payload, indent=2, default=str)

        try:
            llm_resp = generate_text(
                prompt,
                provider=provider_norm,
                model=None,
                temperature=0.2,
                trace_name="board_level_report",
                trace_metadata={
                    "entity_id": str(entity_id),
                    "entity_slug": entity_slug,
                    "report_type": "board_level_report",
                },
                prompt_metadata={
                    "prompt_key": prompt_row.get("key"),
                    "prompt_name": prompt_row.get("name"),
                    "prompt_version": prompt_row.get("version"),
                    "prompt_source": "db",
                },
            )
        except LLMError as exc:
            return {
                "entity_id": str(entity_id),
                "success": False,
                "error": f"LLM generation failed: {exc}",
            }

        save_cached_report(
            project_slug="__entity__",
            provider=llm_resp.provider,
            model=llm_resp.model,
            report_md=llm_resp.text,
            pillar_scores={},
            overall_score=None,
            latency_ms=llm_resp.latency_ms,
            data_hash=data_hash,
            report_type="board_level_report",
            cache_ttl_hours=cache_ttl_hours,
            entity_id=entity_id,
        )

        return {
            "entity_id": str(entity_id),
            "success": True,
            "provider": llm_resp.provider,
            "model": llm_resp.model,
            "latency_ms": llm_resp.latency_ms,
            "report_type": "board_level_report",
        }
    except Exception as exc:
        return {
            "entity_id": str(entity_id),
            "success": False,
            "error": str(exc),
        }


async def batch_generate_reports(
    provider: Optional[str] = None,
    max_projects: Optional[int] = None,
    cache_ttl_hours: Optional[int] = None,
    force_all: bool = False,
    entity_id: Optional[UUID] = None,
    include_governance: bool = True,
    report_types: Optional[list[str]] = None,
) -> dict:
    """
    Generate LLM reports for projects.
    
    Args:
        provider: LLM provider to use (defaults to env var)
        max_projects: Maximum number of projects to process (None = all)
        cache_ttl_hours: Cache TTL override
        force_all: If True, process ALL projects regardless of cache status. 
                   If False, only process projects needing reports.
        entity_id: Optional entity ID to filter projects by entity
    
    Returns:
        Summary dict with counts and results
    """
    provider_norm = provider or os.getenv("LLM_PROVIDER", "ollama")

    if report_types is None:
        report_types = ["ai_summary_llm", "board_level_report"]
        if include_governance:
            report_types.append("governance_requirements_report")

    run_ai_summary = "ai_summary_llm" in report_types
    run_governance = "governance_requirements_report" in report_types
    run_board_level = "board_level_report" in report_types
    
    projects = []
    if run_ai_summary:
        if force_all:
            projects = get_all_projects(entity_id=entity_id)
        else:
            projects = get_projects_needing_reports(
                provider=provider_norm,
                entity_id=entity_id,
                report_type="ai_summary_llm",
            )
    
    if max_projects:
        projects = projects[:max_projects]
    
    results = []
    success_count = 0
    error_count = 0
    cached_count = 0
    
    if run_ai_summary:
        for proj_info in projects:
            project_slug = proj_info["project_slug"]
            result = await generate_report_for_project(
                project_slug=project_slug,
                provider=provider_norm,
                cache_ttl_hours=cache_ttl_hours,
                entity_id=entity_id,
            )
            results.append(result)
            if result["success"]:
                if result.get("cached"):
                    cached_count += 1
                else:
                    success_count += 1
            else:
                error_count += 1
    
    governance_summary = None
    if run_governance:
        governance_projects = (
            get_all_projects(entity_id=entity_id)
            if force_all
            else get_projects_with_requirements(entity_id=entity_id)
        )
        if max_projects:
            governance_projects = governance_projects[:max_projects]

        gov_results = []
        gov_success = 0
        gov_error = 0
        gov_cached = 0

        for proj_info in governance_projects:
            project_slug = proj_info["project_slug"]
            result = await generate_governance_report_for_project(
                project_slug=project_slug,
                provider=provider_norm,
                cache_ttl_hours=cache_ttl_hours,
                entity_id=entity_id,
            )
            gov_results.append(result)
            if result["success"]:
                if result.get("cached"):
                    gov_cached += 1
                else:
                    gov_success += 1
            else:
                gov_error += 1

        governance_summary = {
            "total_processed": len(gov_results),
            "success_count": gov_success,
            "cached_count": gov_cached,
            "error_count": gov_error,
            "results": gov_results,
        }

    board_summary = None
    if run_board_level:
        entity_ids = [entity_id] if entity_id else get_all_entity_ids()
        board_results = []
        board_success = 0
        board_error = 0
        board_cached = 0

        for eid in entity_ids:
            result = await generate_board_level_report_for_entity(
                eid,
                provider=provider_norm,
                cache_ttl_hours=cache_ttl_hours,
            )
            board_results.append(result)
            if result["success"]:
                if result.get("cached"):
                    board_cached += 1
                else:
                    board_success += 1
            else:
                board_error += 1

        board_summary = {
            "total_processed": len(board_results),
            "success_count": board_success,
            "cached_count": board_cached,
            "error_count": board_error,
            "results": board_results,
        }

    return {
        "total_processed": len(results),
        "success_count": success_count,
        "cached_count": cached_count,
        "error_count": error_count,
        "results": results,
        "governance_requirements": governance_summary,
        "board_level_report": board_summary,
    }
