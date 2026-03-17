# app/routers/ai_reports.py
from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel
from psycopg.rows import dict_row
import psycopg
import os
import hashlib
import json
import re
from datetime import datetime, timezone, date
from dotenv import load_dotenv
from typing import Optional
from uuid import UUID

# Make sure this import works. 
# It implies the OTHER file (app/services/ai_project_report.py) exists and is correct.
from app.services.ai_project_report import KpiRow, build_ai_project_report
from app.db_utils import normalize_pg_dsn
from app.services.llm import generate_text, LLMError
from app.services.langfuse_prompts import get_langfuse_prompt_optional
from app.services.llm_report_cache import (
    get_cached_report,
    save_cached_report,
    compute_data_hash,
)
from app.dependencies import get_entity_id_optional, get_current_user_id
from app.services.authorization import verify_entity_access
from app.db_async import get_pool
from app.scorecard import _resolve_entity_id_for_project

load_dotenv()

# Database connection string
DB_URL = normalize_pg_dsn(
    os.getenv("DATABASE_URL", "postgresql://leadai:leadai@localhost:5432/leadai")
)

# --- API router ---
router = APIRouter(
    prefix="/admin/ai-reports",
    tags=["ai-reports"],
)
# -----------------------------------------------------

def _require_provider_keys(provider_norm: str) -> None:
    if provider_norm == "anthropic" and not os.getenv("ANTHROPIC_API_KEY"):
        raise HTTPException(
            status_code=400,
            detail="No ANTHROPIC KEY configured. Set ANTHROPIC_API_KEY in core-svc.",
        )
    if provider_norm == "openai" and not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(
            status_code=400,
            detail="No OPENAI KEY configured. Set OPENAI_API_KEY in core-svc.",
        )
    if provider_norm == "google" and not (
        os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    ):
        raise HTTPException(
            status_code=400,
            detail="No GEMINI KEY configured. Set GEMINI_API_KEY or GOOGLE_API_KEY in core-svc.",
        )

class ProjectReportResp(BaseModel):
    project_slug: str
    project_name: str
    overall_score: float | None
    pillar_scores: dict[str, float]
    report_md: str


class ProjectReportLlmResp(BaseModel):
    project_slug: str
    project_name: str
    overall_score: float | None
    pillar_scores: dict[str, float]
    report_md: str
    provider: str
    model: str
    latency_ms: int
    generated_at: str
    cache_hit: bool


class GovernanceRequirementsReportResp(BaseModel):
    project_slug: str
    project_name: str
    report_md: str
    provider: str
    model: str
    latency_ms: int
    generated_at: str
    prompt_key: str
    prompt_version: int | None
    sources_used: list[dict] = []


class ReportNextStep(BaseModel):
    id: str
    entity_id: str
    report_key: str
    priority: str
    title: str
    owner: str | None
    due_date: str | None
    detail: str | None
    sort_order: int


class ReportNextStepCreate(BaseModel):
    report_key: str = "board-level-report"
    priority: str = "medium"
    title: str
    owner: str | None = None
    due_date: date | None = None
    detail: str | None = None
    sort_order: int = 0


class ReportNextStepUpdate(BaseModel):
    priority: str | None = None
    title: str | None = None
    owner: str | None = None
    due_date: date | None = None
    detail: str | None = None
    sort_order: int | None = None


class ReportScheduleUpdate(BaseModel):
    enabled: bool
    run_hour_utc: int


class BoardLevelNextStepItem(BaseModel):
    """Structured next step for board-level report (enables Jira/automation)."""
    priority: str
    action: str
    owner: str
    due_date: str
    rationale: str


class BoardLevelReportResp(BaseModel):
    entity_id: str
    entity_name: str
    report_md: str
    provider: str
    model: str
    latency_ms: int
    generated_at: str
    prompt_key: str
    prompt_version: int | None
    cache_hit: bool
    next_steps: list[BoardLevelNextStepItem] = []


class BoardLevelDeckResp(BaseModel):
    entity_id: str
    entity_name: str
    deck: dict
    provider: str
    model: str
    latency_ms: int
    generated_at: str
    prompt_key: str
    prompt_version: int | None
    cache_hit: bool


def _normalize_locale(locale: Optional[str]) -> Optional[str]:
    if not locale:
        return None
    normalized = locale.strip().lower()
    if not normalized:
        return None
    return normalized.split(",")[0].split("-")[0]


async def _get_report_translation(
    entity_id: Optional[UUID],
    project_slug: str,
    report_type: str,
    locale: Optional[str],
) -> Optional[str]:
    normalized = _normalize_locale(locale)
    if not normalized or not entity_id:
        return None
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT report_md
            FROM report_translations
            WHERE entity_id = $1 AND project_slug = $2 AND report_type = $3 AND locale = $4
            """,
            entity_id,
            project_slug,
            report_type,
            normalized,
        )
    return row["report_md"] if row else None


def get_conn() -> psycopg.Connection:
    return psycopg.connect(DB_URL, autocommit=False)


async def _load_active_prompt(key: str) -> dict:
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT t.key, t.name, t.active_version_id,
                   v.prompt_text, v.version, v.language
            FROM llm_prompt_templates t
            LEFT JOIN llm_prompt_versions v ON v.id = t.active_version_id
            WHERE t.key = $1
            """,
            key,
        )
    if not row or not row["prompt_text"]:
        raise HTTPException(status_code=404, detail="Active prompt not found")
    return dict(row)


async def get_active_prompt_optional(
    key: str, variables: Optional[dict[str, str]] = None
) -> dict | None:
    """Load active prompt template by key. Returns None if not found (no HTTPException)."""
    langfuse_prompt = get_langfuse_prompt_optional(key, variables)
    if langfuse_prompt:
        return langfuse_prompt
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT t.key, t.name, t.active_version_id,
                   v.prompt_text, v.version, v.language
            FROM llm_prompt_templates t
            LEFT JOIN llm_prompt_versions v ON v.id = t.active_version_id
            WHERE t.key = $1
            """,
            key,
        )
    if not row or not row["prompt_text"]:
        return None
    return dict(row)


def _build_executive_report_vars(
    project_name: str,
    project_slug: str,
    kpis: list[KpiRow],
    pillar_scores: dict[str, float],
    overall_score: float | None,
) -> dict[str, str]:
    """Build variable dict for Executive / AI Summary LLM prompt ($Project Name, etc.)."""
    weak_kpis = sorted(
        [k for k in kpis if k.kpi_score is not None],
        key=lambda k: k.kpi_score or 0,
    )[:10]
    pillar_lines = [
        f"- {pillar}: {score:.1f}% ({_score_band(score)})"
        for pillar, score in sorted(pillar_scores.items(), key=lambda x: x[1])
    ]
    weak_kpi_lines = [
        f"- {k.pillar} | {k.kpi_name} ({k.kpi_key}) = {k.kpi_score:.1f}% | Owner: {k.owner or 'Unassigned'}"
        for k in weak_kpis
    ]
    return {
        "Project Name": project_name or project_slug,
        "Project Slug": project_slug,
        "Overall Score": f"{overall_score:.1f}%" if overall_score is not None else "N/A",
        "Pillar Performance": "\n".join(pillar_lines) if pillar_lines else "- No pillar data",
        "Lowest Performing KPIs": "\n".join(weak_kpi_lines) if weak_kpi_lines else "- No KPI scores available",
    }


def _apply_prompt_vars(prompt: str, variables: dict[str, str]) -> str:
    text = prompt
    for key, value in variables.items():
        text = text.replace(f"${key}", value)
        text = text.replace(f"{{{{{key}}}}}", value)
        text = text.replace(f"{{{{ {key} }}}}", value)
    # Also replace common literal phrases if present
    if "Primary Role (from assessment)" in text and variables.get("Primary Role"):
        text = text.replace(
            "Primary Role (from assessment)", variables["Primary Role"]
        )
    if (
        "Risk Classification (from assessment)" in text
        and variables.get("Risk Classification")
    ):
        text = text.replace(
            "Risk Classification (from assessment)",
            variables["Risk Classification"],
        )
    return text


def _format_kpi_table(kpi_rows: list[dict]) -> str:
    if not kpi_rows:
        return "No KPI data available."
    lines = ["KPI | Score | ISO 42001 | NIST Clause | EU AI Act"]
    lines.append("---|---|---|---|---")
    for row in kpi_rows:
        lines.append(
            f"{row.get('kpi_name') or row.get('kpi_key') or '—'} | "
            f"{row.get('kpi_score') or '—'} | "
            f"{row.get('iso_42001_clause') or '—'} | "
            f"{row.get('nist_clause') or '—'} | "
            f"{row.get('euaiact_clause') or '—'}"
        )
    return "\n".join(lines)


def _summarize_sources(rows: list[dict], max_chars: int = 4000) -> str:
    if not rows:
        return "No knowledge vault sources available."
    chunks: list[str] = []
    used = 0
    for row in rows:
        title = row.get("title") or "Untitled"
        source_type = row.get("source_type") or "text"
        content = (row.get("content") or "").strip()
        file_name = row.get("file_name") or ""
        if not content and not file_name:
            continue
        snippet = content[:1500] if content else f"[File uploaded: {file_name}]"
        block = f"- {title} ({source_type})\n{snippet}"
        if used + len(block) > max_chars:
            break
        chunks.append(block)
        used += len(block)
    return "\n".join(chunks) if chunks else "No usable source content."


def _normalize_hash_payload(value):
    if isinstance(value, dict):
        items = []
        for key, val in value.items():
            norm_key = "null" if key is None else str(key)
            items.append((norm_key, _normalize_hash_payload(val)))
        return {k: v for k, v in sorted(items, key=lambda item: item[0])}
    if isinstance(value, (list, tuple)):
        return [_normalize_hash_payload(item) for item in value]
    return value


def _compute_governance_requirements_hash(payload: dict) -> str:
    """
    Compute a stable hash for governance requirements report inputs.
    """
    normalized = _normalize_hash_payload(payload)
    data_str = json.dumps(normalized, sort_keys=True, default=str)
    return hashlib.sha256(data_str.encode()).hexdigest()


def _compute_board_level_hash(payload: dict) -> str:
    """
    Compute a stable hash for board-level report inputs.
    """
    normalized = _normalize_hash_payload(payload)
    data_str = json.dumps(normalized, sort_keys=True, default=str)
    return hashlib.sha256(data_str.encode()).hexdigest()


def _format_next_steps_markdown(steps: list[dict]) -> str:
    if not steps:
        return ""
    lines = ["## Next Steps (90 Days)"]
    for step in steps:
        priority = (step.get("priority") or "Medium").title()
        title = step.get("title") or "Untitled"
        owner = step.get("owner") or "TBD"
        due = step.get("due_date") or "TBD"
        detail = step.get("detail") or ""
        lines.append(f"\n**{priority}**")
        lines.append(title)
        lines.append(f"Owner: {owner}")
        lines.append(f"Due: {due}")
        if detail:
            lines.append(detail)
    return "\n".join(lines)


def _replace_next_steps_section(report_md: str, steps: list[dict]) -> str:
    if not steps:
        return report_md
    manual_section = _format_next_steps_markdown(steps)
    if not manual_section:
        return report_md
    pattern = r"(?:^|\n)#{2,3}\s+Next Steps \(90 Days\).*?(?=\n#{1,3}\s+|\Z)"
    updated = re.sub(pattern, "\n\n" + manual_section + "\n", report_md or "", flags=re.S)
    if updated.strip() == (report_md or "").strip():
        updated = (report_md or "").rstrip() + "\n\n" + manual_section + "\n"
    return updated


def _parse_next_steps_from_report(report_md: str) -> list[BoardLevelNextStepItem]:
    """
    Parse the Next Steps (90 Days) markdown table from report text.
    Returns structured list for UI and automation (e.g. Jira).
    """
    if not (report_md or "").strip():
        return []
    heading = re.search(r"\n?##\s*Next Steps\s*(?:\(90 Days\))?\s*\n", report_md, re.I)
    if not heading:
        return []
    start = heading.end()
    rest = report_md[start:]
    next_sec = re.search(r"\n##\s+", rest)
    section = rest[: next_sec.start()] if next_sec else rest
    rows = []
    for line in section.splitlines():
        line = line.strip()
        if not line or "|" not in line:
            continue
        if re.match(r"^[-:\s|]+$", line):
            continue
        cells = [c.strip() for c in line.split("|")]
        if len(cells) >= 2:
            if cells and not cells[0]:
                cells = cells[1:]
            if cells and not cells[-1]:
                cells = cells[:-1]
        if len(cells) >= 2:
            rows.append(cells)
    if not rows:
        one_line = re.sub(r"\s*\n\s*", " ", section).strip()
        for part in re.split(r"\s*\|\s*\|\s*", one_line):
            part = re.sub(r"^\|\s*|\s*\|$", "", part).strip()
            if not part or re.match(r"^[-:\s]+$", part):
                continue
            cells = [c.strip() for c in part.split("|")]
            if len(cells) >= 2:
                rows.append(cells)
    if not rows:
        return []
    header = rows[0]
    def idx(key: str) -> int:
        for i, h in enumerate(header):
            if key in (h or "").lower():
                return i
        return -1
    pri_i = idx("priority") if idx("priority") >= 0 else 0
    act_i = idx("action") if idx("action") >= 0 else 1
    own_i = idx("owner") if idx("owner") >= 0 else 2
    due_i = idx("due") if idx("due") >= 0 else 3
    rat_i = idx("rationale") if idx("rationale") >= 0 else 4
    data_rows = [
        r for r in rows[1:]
        if any(c and not re.match(r"^[-—\s]+$", c or "") for c in r)
        and not all(re.match(r"^[-:\s]+$", c or "") for c in r)
    ]
    out = []
    for r in data_rows:
        def cell(row: list, i: int) -> str:
            return (row[i] if 0 <= i < len(row) else "") or ""
        out.append(
            BoardLevelNextStepItem(
                priority=cell(r, pri_i),
                action=cell(r, act_i),
                owner=cell(r, own_i) or "TBD",
                due_date=cell(r, due_i) or "TBD",
                rationale=cell(r, rat_i),
            )
        )
    return out


def _manual_steps_to_next_steps(manual_steps: list[dict]) -> list[BoardLevelNextStepItem]:
    """Convert report_next_steps rows to BoardLevelNextStepItem list."""
    return [
        BoardLevelNextStepItem(
            priority=(s.get("priority") or "Medium").title(),
            action=s.get("title") or "Untitled",
            owner=s.get("owner") or "TBD",
            due_date=s.get("due_date") or "TBD",
            rationale=s.get("detail") or "",
        )
        for s in manual_steps
    ]


async def _fetch_next_steps(conn, entity_id: UUID, report_key: str) -> list[dict]:
    rows = await conn.fetch(
        """
        SELECT id, priority, title, owner, due_date, detail, sort_order
        FROM report_next_steps
        WHERE entity_id = $1 AND report_key = $2
        ORDER BY sort_order ASC, created_at ASC
        """,
        entity_id,
        report_key,
    )
    return [
        {
            "id": str(r["id"]),
            "priority": r["priority"],
            "title": r["title"],
            "owner": r["owner"],
            "due_date": r["due_date"].isoformat() if r.get("due_date") else None,
            "detail": r["detail"],
            "sort_order": r["sort_order"],
        }
        for r in rows
    ]


def _parse_llm_json_payload(raw_text: str) -> dict:
    text = (raw_text or "").strip()
    if not text:
        return {"title": "Board-Level Deck", "slides": []}
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(text[start : end + 1])
            except json.JSONDecodeError:
                pass
    return {
        "title": "Board-Level Deck",
        "slides": [
            {
                "title": "Deck Output Error",
                "bullets": [
                    "The LLM response could not be parsed as JSON.",
                    "Raw output included below for review.",
                    text[:2000],
                ],
            }
        ],
    }


async def _build_board_level_payload(conn, entity_id: UUID) -> tuple[str, str, str, str, dict]:
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
        raise HTTPException(status_code=404, detail="Entity not found")

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
        "policy_status_counts": {r["policy_status"]: r["count"] for r in policy_status_counts},
        "policy_version_counts": {r["version_status"]: r["count"] for r in policy_version_counts},
        "policy_review_counts": {r["status"]: r["count"] for r in policy_review_counts},
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

    return entity_slug, entity_name, primary_role, risk_classification, data_payload

async def resolve_entity_id_for_report(
    project_slug: str,
    entity_id: Optional[UUID],
    user_id: UUID,
) -> UUID:
    """
    Resolve entity_id for report endpoints.
    - If provided, verify access.
    - If missing, resolve from project slug + user (supports master admin).
    """
    if entity_id is not None:
        await verify_entity_access(user_id, entity_id, required_role="viewer")
        return entity_id
    pool = await get_pool()
    async with pool.acquire() as conn:
        resolved = await _resolve_entity_id_for_project(conn, project_slug, user_id)
    if resolved is None:
        raise HTTPException(status_code=400, detail="Entity ID is required for this operation")
    return resolved

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



@router.get("/projects/{project_slug}/ai-summary", response_model=ProjectReportResp)
async def get_ai_project_report(
    project_slug: str,
    locale: Optional[str] = Query(default=None),
    entity_id: Optional[UUID] = Depends(get_entity_id_optional),
    user_id: UUID = Depends(get_current_user_id),
):
    """
    Build an AI project summary report for a given project_slug.
    Handles projects with no KPIs gracefully by returning a minimal report.
    """
    from app.scorecard import get_scorecard

    try:
        # Resolve entity context when not provided (supports master admin)
        entity_id = await resolve_entity_id_for_report(project_slug, entity_id, user_id)
        # Use dashboard scorecard as single source of truth so scores match everywhere
        scorecard = await get_scorecard(
            project_slug,
            entity_id=entity_id,
            user_id=user_id,
        )
    except HTTPException as e:
        if e.status_code == 404:
            raise HTTPException(status_code=404, detail=f"Project '{project_slug}' not found")
        raise

    proj = {"slug": scorecard.project.slug, "name": scorecard.project.name}
    pillar_scores = {p.name: p.score_pct for p in scorecard.pillars}
    overall = float(scorecard.overall_pct) if scorecard.overall_pct is not None else 0.0

    # Build KpiRow list from scorecard KPIs so narrative sections are grounded
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

    # Generate Markdown report, but force the executive summary score to match dashboard
    # If no KPIs, build_ai_project_report will handle it gracefully (empty pillars, 0% overall)
    report_md = build_ai_project_report(
        project_name=proj["name"],
        project_slug=proj["slug"],
        kpis=kpi_rows,
        overall_score_override=overall,
    )
    translated_md = await _get_report_translation(
        entity_id, proj["slug"], "ai_summary", locale
    )
    if translated_md:
        report_md = translated_md

    return ProjectReportResp(
        project_slug=proj["slug"],
        project_name=proj["name"],
        overall_score=overall if overall > 0 else None,
        pillar_scores=pillar_scores,
        report_md=report_md,
    )


@router.get(
    "/projects/{project_slug}/ai-summary-llm",
    response_model=ProjectReportLlmResp,
)
async def get_ai_project_report_llm(
    project_slug: str,
    provider: str | None = Query(default=None, description="ollama, openai, anthropic, or google"),
    force_regenerate: bool = Query(default=False, description="Force regeneration even if cached"),
    locale: Optional[str] = Query(default=None),
    entity_id: Optional[UUID] = Depends(get_entity_id_optional),
    user_id: UUID = Depends(get_current_user_id),
):
    """
    Build an AI project summary report using the configured LLM (Ollama, OpenAI, Anthropic, or Google).
    Uses the same scorecard data as the dashboard so overall score and pillar
    scores match (including Pre-GTM Trust Certification / provenance when present).
    Uses caching to avoid regenerating reports on every request.
    """
    import json
    from app.scorecard import get_scorecard

    # Use dashboard scorecard as single source of truth (same overall % and pillars)
    try:
        entity_id = await resolve_entity_id_for_report(project_slug, entity_id, user_id)
        scorecard = await get_scorecard(
            project_slug,
            entity_id=entity_id,
            user_id=user_id,
        )
    except HTTPException as e:
        if e.status_code == 404:
            raise HTTPException(status_code=404, detail=f"Project '{project_slug}' not found")
        raise

    proj = {"slug": scorecard.project.slug, "name": scorecard.project.name}
    pillar_scores = {p.name: p.score_pct for p in scorecard.pillars}
    overall = float(scorecard.overall_pct) if scorecard.overall_pct is not None else 0.0

    # Build KpiRow list from scorecard KPIs for prompt (weak KPIs section)
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

    # Normalize provider (ollama, openai, anthropic, google; Azure/others use openai + OPENAI_BASE_URL)
    _allowed_providers = {"ollama", "openai", "anthropic", "google"}
    provider_norm = provider.lower() if provider else None
    if provider_norm and provider_norm not in _allowed_providers:
        raise HTTPException(
            status_code=400,
            detail=f"provider must be one of: {', '.join(sorted(_allowed_providers))}",
        )
    provider_norm = provider_norm or os.getenv("LLM_PROVIDER", "ollama").lower()
    _require_provider_keys(provider_norm)

    # Compute data hash for cache lookup
    data_hash = compute_data_hash(kpi_rows, pillar_scores, overall)

    # Get entity_id for cache lookup
    effective_entity_id = entity_id
    if not effective_entity_id:
        # Get entity_id from project
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT entity_id FROM entity_projects WHERE slug = %s", (project_slug,))
                row = cur.fetchone()
                if row:
                    effective_entity_id = row[0]
    
    # Check cache first (unless force_regenerate is True)
    if not force_regenerate and effective_entity_id:
        cached = get_cached_report(
            project_slug=project_slug,
            provider=provider_norm,
            data_hash=data_hash,
            report_type="ai_summary_llm",
            entity_id=effective_entity_id,
        )
        if cached:
            # Return cached report
            pillar_scores_dict = cached["pillar_scores"]
            if isinstance(pillar_scores_dict, str):
                pillar_scores_dict = json.loads(pillar_scores_dict)
            elif isinstance(pillar_scores_dict, dict):
                pass  # Already a dict
            else:
                pillar_scores_dict = {}
            translated_md = await _get_report_translation(
                entity_id, project_slug, "ai_summary_llm", locale
            )
            
            return ProjectReportLlmResp(
                project_slug=proj["slug"],
                project_name=proj["name"],
                overall_score=cached["overall_score"],
                pillar_scores=pillar_scores_dict,
                report_md=translated_md or cached["report_md"],
                provider=cached["provider"],
                model=cached["model"],
                latency_ms=cached["latency_ms"],
                generated_at=cached["generated_at"].isoformat() if hasattr(cached["generated_at"], "isoformat") else str(cached["generated_at"]),
                cache_hit=True,
            )

    # Cache miss or force regenerate - generate new report
    vars = _build_executive_report_vars(
        project_name=proj["name"] or proj["slug"],
        project_slug=proj["slug"],
        kpis=kpi_rows,
        pillar_scores=pillar_scores,
        overall_score=overall,
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
            overall_score=overall,
        )

    try:
        trace_meta = {
            "project_slug": proj["slug"],
            "project_name": proj["name"],
            "entity_id": str(effective_entity_id) if effective_entity_id else None,
            "report_type": "ai_summary_llm",
            "model_provider": provider_norm,
            # Use provider-specific model env vars if available, otherwise fall back
            "model_version": (
                os.getenv("OPENAI_MODEL")
                if provider_norm == "openai"
                else os.getenv("ANTHROPIC_MODEL")
                if provider_norm == "anthropic"
                else os.getenv("GEMINI_MODEL") or os.getenv("GOOGLE_MODEL")
                if provider_norm == "google"
                else None
            ),
        }
        llm_resp = generate_text(
            prompt,
            provider=provider_norm,
            trace_name="ai_summary_llm",
            trace_metadata=trace_meta,
            prompt_metadata=prompt_meta,
        )
    except LLMError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    # Save to cache
    cache_ttl_hours = int(os.getenv("LLM_REPORT_CACHE_TTL_HOURS", "24"))
    if effective_entity_id:
        save_cached_report(
            project_slug=proj["slug"],
            provider=llm_resp.provider,
            model=llm_resp.model,
            report_md=llm_resp.text,
            pillar_scores=pillar_scores,
            overall_score=overall,
            latency_ms=llm_resp.latency_ms,
            data_hash=data_hash,
            report_type="ai_summary_llm",
            cache_ttl_hours=cache_ttl_hours if cache_ttl_hours > 0 else None,
            entity_id=effective_entity_id,
        )

    translated_md = await _get_report_translation(
        entity_id, project_slug, "ai_summary_llm", locale
    )
    return ProjectReportLlmResp(
        project_slug=proj["slug"],
        project_name=proj["name"],
        overall_score=overall,
        pillar_scores=pillar_scores,
        report_md=translated_md or llm_resp.text,
        provider=llm_resp.provider,
        model=llm_resp.model,
        latency_ms=llm_resp.latency_ms,
        generated_at=datetime.now(timezone.utc).isoformat(),
        cache_hit=False,
    )


@router.get(
    "/projects/{project_slug}/governance-requirements-report",
    response_model=GovernanceRequirementsReportResp,
)
async def get_governance_requirements_report(
    project_slug: str,
    provider: str | None = Query(default=None, description="ollama, openai, anthropic, or google"),
    locale: Optional[str] = Query(default=None),
    entity_id: Optional[UUID] = Depends(get_entity_id_optional),
    user_id: UUID = Depends(get_current_user_id),
):
    """
    Generate a Governance Requirements Report using the active prompt template.
    Pulls selected frameworks from ai_requirement_register and knowledge vault sources.
    """
    from app.scorecard import get_scorecard

    # Resolve entity_id + scorecard data
    entity_id = await resolve_entity_id_for_report(project_slug, entity_id, user_id)
    scorecard = await get_scorecard(
        project_slug,
        entity_id=entity_id,
        user_id=user_id,
    )

    project_name = scorecard.project.name or project_slug

    pool = await get_pool()
    async with pool.acquire() as conn:
        # Entity profile (primary role / risk classification)
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
            entity_id,
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

        # Selected governance frameworks for this project
        req_rows = await conn.fetch(
            """
            SELECT framework, requirement_code, uc_id, status
            FROM ai_requirement_register
            WHERE project_slug = $1 AND entity_id = $2
            ORDER BY framework, requirement_code
            """,
            project_slug,
            entity_id,
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

        # Knowledge Vault sources (project or entity)
        source_rows = await conn.fetch(
            """
            SELECT title, source_type, content, file_name
            FROM report_sources
            WHERE project_slug IS NULL
            ORDER BY updated_at DESC NULLS LAST, created_at DESC
            LIMIT 8
            """
        )
        sources_used = [
            {
                "title": row["title"],
                "source_type": row["source_type"],
                "file_name": row["file_name"],
            }
            for row in source_rows
        ]

        # KPI mapping details
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

    provider_norm = provider.lower() if provider else "ollama"
    _require_provider_keys(provider_norm)
    cache_ttl_hours = int(os.getenv("LLM_REPORT_CACHE_TTL_HOURS", "24"))
    cache_ttl_hours = cache_ttl_hours if cache_ttl_hours > 0 else None

    # Load prompt template
    prompt_key = "governance_requirements_report"
    prompt_row = await _load_active_prompt(prompt_key)
    prompt_text = prompt_row["prompt_text"]

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
            "entity_id": str(entity_id),
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
        entity_id=entity_id,
    )
    if cached:
        translated_md = await _get_report_translation(
            entity_id, project_slug, "governance_requirements_report", locale
        )
        return GovernanceRequirementsReportResp(
            project_slug=project_slug,
            project_name=project_name,
            report_md=translated_md or cached["report_md"],
            provider=cached["provider"],
            model=cached["model"],
            latency_ms=cached["latency_ms"],
            generated_at=cached["generated_at"].isoformat()
            if hasattr(cached["generated_at"], "isoformat")
            else str(cached["generated_at"]),
            prompt_key=prompt_key,
            prompt_version=prompt_row.get("version"),
            sources_used=sources_used,
        )

    # Build prompt
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

    # Generate via LLM (default Ollama)
    try:
        llm_resp = generate_text(
            prompt,
            provider=provider_norm,
            model=None,
            temperature=0.2,
        )
    except LLMError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    generated_at = datetime.now(timezone.utc).isoformat()

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
        entity_id=entity_id,
    )

    translated_md = await _get_report_translation(
        entity_id, project_slug, "governance_requirements_report", locale
    )
    return GovernanceRequirementsReportResp(
        project_slug=project_slug,
        project_name=project_name,
        report_md=translated_md or llm_resp.text,
        provider=llm_resp.provider,
        model=llm_resp.model,
        latency_ms=llm_resp.latency_ms,
        generated_at=generated_at,
        prompt_key=prompt_key,
        prompt_version=prompt_row.get("version"),
        sources_used=sources_used,
    )


@router.get("/board-level-report", response_model=BoardLevelReportResp)
async def get_board_level_report(
    provider: str | None = Query(default=None, description="ollama, openai, anthropic, or google"),
    locale: Optional[str] = Query(default=None),
    entity_id: Optional[UUID] = Depends(get_entity_id_optional),
    user_id: UUID = Depends(get_current_user_id),
):
    """
    Generate a board-level summary report for all projects in an entity.
    """
    if entity_id is None:
        raise HTTPException(status_code=400, detail="Entity ID is required for this operation")
    await verify_entity_access(user_id, entity_id, required_role="viewer")

    provider_norm = (provider or "openai").lower()
    _require_provider_keys(provider_norm)
    cache_ttl_hours = int(os.getenv("LLM_REPORT_CACHE_TTL_HOURS", "24"))
    cache_ttl_hours = cache_ttl_hours if cache_ttl_hours > 0 else None

    pool = await get_pool()
    async with pool.acquire() as conn:
        (
            entity_slug,
            entity_name,
            primary_role,
            risk_classification,
            data_payload,
        ) = await _build_board_level_payload(conn, entity_id)
        manual_steps = await _fetch_next_steps(conn, entity_id, "board-level-report")

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
        translated_md = await _get_report_translation(
            entity_id, "__entity__", "board_level_report", locale
        )
        report_md = translated_md or cached["report_md"]
        report_md = _replace_next_steps_section(report_md, manual_steps)
        next_steps = (
            _manual_steps_to_next_steps(manual_steps)
            if manual_steps
            else _parse_next_steps_from_report(report_md)
        )
        return BoardLevelReportResp(
            entity_id=str(entity_id),
            entity_name=entity_name,
            report_md=report_md,
            provider=cached["provider"],
            model=cached["model"],
            latency_ms=cached["latency_ms"],
            generated_at=cached["generated_at"].isoformat()
            if hasattr(cached["generated_at"], "isoformat")
            else str(cached["generated_at"]),
            prompt_key="board-level-report",
            prompt_version=None,
            cache_hit=True,
            next_steps=next_steps,
        )

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
        raise HTTPException(status_code=502, detail=str(exc)) from exc

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

    translated_md = await _get_report_translation(
        entity_id, "__entity__", "board_level_report", locale
    )
    generated_at = datetime.now(timezone.utc).isoformat()
    report_md = translated_md or llm_resp.text
    report_md = _replace_next_steps_section(report_md, manual_steps)
    next_steps = (
        _manual_steps_to_next_steps(manual_steps)
        if manual_steps
        else _parse_next_steps_from_report(report_md)
    )
    return BoardLevelReportResp(
        entity_id=str(entity_id),
        entity_name=entity_name,
        report_md=report_md,
        provider=llm_resp.provider,
        model=llm_resp.model,
        latency_ms=llm_resp.latency_ms,
        generated_at=generated_at,
        prompt_key=prompt_key,
        prompt_version=prompt_row.get("version"),
        cache_hit=False,
        next_steps=next_steps,
    )


@router.get("/next-steps", response_model=list[ReportNextStep])
async def list_report_next_steps(
    entity_id: Optional[UUID] = Depends(get_entity_id_optional),
    report_key: str = Query(default="board-level-report"),
    user_id: UUID = Depends(get_current_user_id),
):
    if entity_id is None:
        raise HTTPException(status_code=400, detail="Entity ID is required for this operation")
    await verify_entity_access(user_id, entity_id, required_role="viewer")
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id, entity_id, report_key, priority, title, owner, due_date, detail, sort_order
            FROM report_next_steps
            WHERE entity_id = $1 AND report_key = $2
            ORDER BY sort_order ASC, created_at ASC
            """,
            entity_id,
            report_key,
        )
    return [
        ReportNextStep(
            id=str(r["id"]),
            entity_id=str(r["entity_id"]),
            report_key=r["report_key"],
            priority=r["priority"],
            title=r["title"],
            owner=r["owner"],
            due_date=r["due_date"].isoformat() if r.get("due_date") else None,
            detail=r["detail"],
            sort_order=r["sort_order"],
        )
        for r in rows
    ]


@router.post("/next-steps", response_model=ReportNextStep)
async def create_report_next_step(
    body: ReportNextStepCreate,
    entity_id: Optional[UUID] = Depends(get_entity_id_optional),
    user_id: UUID = Depends(get_current_user_id),
):
    if entity_id is None:
        raise HTTPException(status_code=400, detail="Entity ID is required for this operation")
    await verify_entity_access(user_id, entity_id, required_role="admin")
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO report_next_steps (entity_id, report_key, priority, title, owner, due_date, detail, sort_order, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
            RETURNING id, entity_id, report_key, priority, title, owner, due_date, detail, sort_order
            """,
            entity_id,
            body.report_key,
            body.priority,
            body.title,
            body.owner,
            body.due_date,
            body.detail,
            body.sort_order,
        )
    return ReportNextStep(
        id=str(row["id"]),
        entity_id=str(row["entity_id"]),
        report_key=row["report_key"],
        priority=row["priority"],
        title=row["title"],
        owner=row["owner"],
        due_date=row["due_date"].isoformat() if row.get("due_date") else None,
        detail=row["detail"],
        sort_order=row["sort_order"],
    )


@router.patch("/next-steps/{step_id}", response_model=ReportNextStep)
async def update_report_next_step(
    step_id: UUID,
    body: ReportNextStepUpdate,
    entity_id: Optional[UUID] = Depends(get_entity_id_optional),
    user_id: UUID = Depends(get_current_user_id),
):
    if entity_id is None:
        raise HTTPException(status_code=400, detail="Entity ID is required for this operation")
    await verify_entity_access(user_id, entity_id, required_role="admin")
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT id
            FROM report_next_steps
            WHERE id = $1 AND entity_id = $2
            """,
            step_id,
            entity_id,
        )
        if not row:
            raise HTTPException(status_code=404, detail="Next step not found")

        await conn.execute(
            """
            UPDATE report_next_steps
            SET priority = COALESCE($1, priority),
                title = COALESCE($2, title),
                owner = COALESCE($3, owner),
                due_date = COALESCE($4, due_date),
                detail = COALESCE($5, detail),
                sort_order = COALESCE($6, sort_order),
                updated_at = NOW()
            WHERE id = $7
            """,
            body.priority,
            body.title,
            body.owner,
            body.due_date,
            body.detail,
            body.sort_order,
            step_id,
        )
        updated = await conn.fetchrow(
            """
            SELECT id, entity_id, report_key, priority, title, owner, due_date, detail, sort_order
            FROM report_next_steps
            WHERE id = $1
            """,
            step_id,
        )
    return ReportNextStep(
        id=str(updated["id"]),
        entity_id=str(updated["entity_id"]),
        report_key=updated["report_key"],
        priority=updated["priority"],
        title=updated["title"],
        owner=updated["owner"],
        due_date=updated["due_date"].isoformat() if updated.get("due_date") else None,
        detail=updated["detail"],
        sort_order=updated["sort_order"],
    )


@router.delete("/next-steps/{step_id}", status_code=204)
async def delete_report_next_step(
    step_id: UUID,
    entity_id: Optional[UUID] = Depends(get_entity_id_optional),
    user_id: UUID = Depends(get_current_user_id),
):
    if entity_id is None:
        raise HTTPException(status_code=400, detail="Entity ID is required for this operation")
    await verify_entity_access(user_id, entity_id, required_role="admin")
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT id
            FROM report_next_steps
            WHERE id = $1 AND entity_id = $2
            """,
            step_id,
            entity_id,
        )
        if not row:
            raise HTTPException(status_code=404, detail="Next step not found")
        await conn.execute(
            """
            DELETE FROM report_next_steps
            WHERE id = $1
            """,
            step_id,
        )
    return None


@router.get("/board-level-deck", response_model=BoardLevelDeckResp)
async def get_board_level_deck(
    provider: str | None = Query(default=None, description="ollama, openai, anthropic, or google"),
    locale: Optional[str] = Query(default=None),
    entity_id: Optional[UUID] = Depends(get_entity_id_optional),
    user_id: UUID = Depends(get_current_user_id),
):
    """
    Generate a board-level presentation deck (JSON) for all projects in an entity.
    """
    if entity_id is None:
        raise HTTPException(status_code=400, detail="Entity ID is required for this operation")
    await verify_entity_access(user_id, entity_id, required_role="viewer")

    provider_norm = (provider or "openai").lower()
    _require_provider_keys(provider_norm)
    cache_ttl_hours = int(os.getenv("LLM_REPORT_CACHE_TTL_HOURS", "24"))
    cache_ttl_hours = cache_ttl_hours if cache_ttl_hours > 0 else None

    pool = await get_pool()
    async with pool.acquire() as conn:
        (
            entity_slug,
            entity_name,
            primary_role,
            risk_classification,
            data_payload,
        ) = await _build_board_level_payload(conn, entity_id)

    data_hash = _compute_board_level_hash(data_payload)
    cached = get_cached_report(
        project_slug="__entity__",
        provider=provider_norm,
        data_hash=data_hash,
        report_type="board_level_deck",
        cache_ttl_hours=cache_ttl_hours,
        entity_id=entity_id,
    )
    if cached:
        deck = _parse_llm_json_payload(cached["report_md"])
        return BoardLevelDeckResp(
            entity_id=str(entity_id),
            entity_name=entity_name,
            deck=deck,
            provider=cached["provider"],
            model=cached["model"],
            latency_ms=cached["latency_ms"],
            generated_at=cached["generated_at"].isoformat()
            if hasattr(cached["generated_at"], "isoformat")
            else str(cached["generated_at"]),
            prompt_key="board-level-report-deck",
            prompt_version=None,
            cache_hit=True,
        )

    prompt_key = "board-level-report-deck"
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
            trace_name="board_level_deck",
            trace_metadata={
                "entity_id": str(entity_id),
                "entity_slug": entity_slug,
                "report_type": "board_level_deck",
            },
            prompt_metadata={
                "prompt_key": prompt_row.get("key"),
                "prompt_name": prompt_row.get("name"),
                "prompt_version": prompt_row.get("version"),
                "prompt_source": "db",
            },
        )
    except LLMError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    deck = _parse_llm_json_payload(llm_resp.text)
    save_cached_report(
        project_slug="__entity__",
        provider=llm_resp.provider,
        model=llm_resp.model,
        report_md=json.dumps(deck, ensure_ascii=False),
        pillar_scores={},
        overall_score=None,
        latency_ms=llm_resp.latency_ms,
        data_hash=data_hash,
        report_type="board_level_deck",
        cache_ttl_hours=cache_ttl_hours,
        entity_id=entity_id,
    )

    return BoardLevelDeckResp(
        entity_id=str(entity_id),
        entity_name=entity_name,
        deck=deck,
        provider=llm_resp.provider,
        model=llm_resp.model,
        latency_ms=llm_resp.latency_ms,
        generated_at=datetime.utcnow().isoformat(),
        prompt_key=prompt_row.get("key"),
        prompt_version=prompt_row.get("version"),
        cache_hit=False,
    )


@router.get("/schedule")
async def list_report_schedules_endpoint(
    user_id: UUID = Depends(get_current_user_id),
):
    from app.services.llm_report_schedule import list_report_schedules

    return {"items": await list_report_schedules()}


@router.put("/schedule/{report_type}")
async def update_report_schedule_endpoint(
    report_type: str,
    payload: ReportScheduleUpdate,
    user_id: UUID = Depends(get_current_user_id),
):
    from app.services.llm_report_schedule import REPORT_TYPES, upsert_report_schedule

    if report_type not in REPORT_TYPES:
        raise HTTPException(status_code=404, detail="Unknown report_type")
    if payload.run_hour_utc < 0 or payload.run_hour_utc > 23:
        raise HTTPException(status_code=400, detail="run_hour_utc must be between 0 and 23")

    return await upsert_report_schedule(
        report_type,
        enabled=payload.enabled,
        run_hour_utc=payload.run_hour_utc,
    )


@router.post("/batch-generate")
async def batch_generate_reports_endpoint(
    provider: str | None = Query(default=None, description="ollama, openai, anthropic, or google"),
    max_projects: int | None = Query(default=None, description="Maximum number of projects to process"),
    force_all: bool = Query(default=False, description="Process ALL projects regardless of cache status"),
):
    """
    Manually trigger batch generation of LLM reports.
    By default, only processes projects needing reports (missing/expired cache).
    Set force_all=True to regenerate reports for ALL projects.
    """
    from app.services.llm_report_batch import batch_generate_reports
    
    cache_ttl_hours = int(os.getenv("LLM_REPORT_CACHE_TTL_HOURS", "24"))
    cache_ttl_hours = cache_ttl_hours if cache_ttl_hours > 0 else None
    
    result = await batch_generate_reports(
        provider=provider,
        max_projects=max_projects,
        cache_ttl_hours=cache_ttl_hours,
        force_all=force_all,
    )
    
    return result
