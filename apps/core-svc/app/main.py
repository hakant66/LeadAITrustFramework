# app/main.py
# =============================================================================
# Title : LeadAI Core Service - FastAPI Application Entry Point
# Author: Hakan Taskin (project owner) / Maintainer: Core Platform Team
# Date  : 2025-11-10
#
# Purpose
# -------
# Bootstraps the LeadAI Core Service web API (FastAPI), configures CORS for
# local development, exposes a simple health check, and mounts all feature
# routers (scorecard, trends, projects, admin).
#
# Important Notes
# ---------------
# * CORS: Restricted to localhost dev origins. Adjust/lock down for production.
# * Healthz: Calls ping_db() to verify Postgres connectivity.
# * Router Order: Not order-sensitive here, but keep related endpoints grouped.
# * Imports: Routers are imported once to ensure side effects/logging and
#   to keep startup predictable.
# * Debug Print: Aids diagnosing module import paths during dev; safe to remove
#   or gate behind an environment flag for production verbosity.
# =============================================================================

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import os
from datetime import datetime, timezone, timedelta

from app.db import ping_db
from app.scorecard import router as scorecard_router         
from app.routers.trends import router as trends_router      
from app.routers.projects import router as projects_router   
from app.routers.admin import router as admin_router        
from app.routers.reports import router as reports_router     
from app.routers.kpidetail import router as kpidetail_router 
from app.routers.ai_reports import router as ai_reports_router
from app.routers.trust_axes import router as trust_axes_router
from app.routers.trust_provenance import router as trust_provenance_router
from app.routers.provenance_admin import router as provenance_admin_router
from app.routers.audit import router as audit_router
from app.routers.ai_legal_standing import router as ai_legal_standing_router
from app.routers.entity import router as entity_router
from app.routers.user import router as user_router
from app.routers.master_admin import router as master_admin_router
from app.routers.ui_translations import router as ui_translations_router
from app.routers.jira import router as jira_router
from app.routers.intelligent_alerts import router as intelligent_alerts_router
from app.services.provenance_rules import load_rules_config, ProvenanceRulesError
from app.services.llm import list_models, LLMError
from app.services.policy_defaults import ensure_default_policies
from app.services.eu_ai_act_requirements import ensure_eu_ai_act_requirements
from app.services.data_governance import compute_data_governance_warnings
from app.services.llm_report_batch import batch_generate_reports
from app.services.llm_report_cache import cleanup_expired_cache
from app.services.provenance_manifest_batch import batch_build_manifests
from app.score_engine import recompute_all
from app.services.audit_log import append_audit_event




# --- FastAPI app metadata -----------------------------------------------------
app = FastAPI(
    title="LeadAI Core Service",
    description="Backend API for LeadAI scorecards, trends, projects, and admin ops.",
    version="0.1.0",
)

# --- CORS (development profile) ----------------------------------------------
# Allows local Next.js UI (port 3000) to talk to this API. For production,
# consider a stricter allowlist and HTTPS origins only.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Liveness / readiness probe ----------------------------------------------
# Lightweight health check used by local dev and container orchestrators.
@app.get("/healthz")
def healthz():
    ok = ping_db()
    return {"status": "ok" if ok else "fail", "postgres": ok}

# --- LLM connectivity check --------------------------------------------------
@app.get("/health/llm")
def health_llm():
    provider = os.getenv("LLM_PROVIDER", "ollama").lower()
    model_env_map = {
        "ollama": "OLLAMA_MODEL",
        "openai": "OPENAI_MODEL",
        "anthropic": "ANTHROPIC_MODEL",
        "google": "GEMINI_MODEL",
    }
    model_env = model_env_map.get(provider, "")
    model = os.getenv(model_env) if model_env else None
    if provider == "google" and not model:
        model = os.getenv("GOOGLE_MODEL")
    try:
        models = list_models()
    except LLMError as exc:
        return {
            "status": "fail",
            "provider": provider,
            "model": model,
            "error": str(exc),
            "models": [],
        }
    return {
        "status": "ok",
        "provider": provider,
        "model": model,
        "models": [
            (m.get("name") or m.get("id") or m.get("model"))
            for m in models
            if isinstance(m, dict)
        ],
        "count": len(models),
    }

# --- Mount feature routers ----------------------------------------------------
# Keep these grouped and explicit to make API surface obvious.
# Each router carries its own prefix and tags.
app.include_router(intelligent_alerts_router)  # /scorecard/alert-rules, /scorecard/trend-alerts (before scorecard to match first)
app.include_router(scorecard_router)   # /scorecard: scorecards, pillars, controls, updates
app.include_router(trends_router)      # /scorecard/.../trends: time-series derived from history
app.include_router(projects_router)    # /projects: list/delete projects
app.include_router(admin_router)       # /admin: control CRUD, evidence, imports/exports
app.include_router(reports_router)     # /admin/reports: KPI report endpoints
app.include_router(kpidetail_router)   # /scorecard/.../kpis/{kpi_key}: KPI detail
app.include_router(ai_reports_router)  # /
app.include_router(trust_axes_router)  # /trust/axes: derived trust axes
app.include_router(trust_provenance_router)  # /trust/provenance: provenance rule engine
app.include_router(provenance_admin_router)  # /admin/provenance-manifests
app.include_router(audit_router)  # /audit: immutable audit events
app.include_router(ai_legal_standing_router)  # /ai-legal-standing: EU AI Act decision tree
app.include_router(entity_router)  # /entity: entity profile from /entity landing page
app.include_router(user_router)  # /user: current user context (e.g. /user/entities)
app.include_router(master_admin_router)  # /admin/master: list/update/archive all entities
app.include_router(ui_translations_router)  # /ui-translations: public UI translation overrides
app.include_router(jira_router)  # /admin/jira: Jira integration for governance evidence


async def _governance_scheduler(run_hour_utc: int) -> None:
    while True:
        now = datetime.now(timezone.utc)
        next_run = now.replace(hour=run_hour_utc, minute=0, second=0, microsecond=0)
        if next_run <= now:
            next_run += timedelta(days=1)
        sleep_seconds = max(0, (next_run - now).total_seconds())
        await asyncio.sleep(sleep_seconds)
        try:
            await compute_data_governance_warnings()
        except Exception as exc:
            print(f"Governance warnings compute failed: {exc}")


async def _llm_report_batch_scheduler(report_type: str, run_hour_utc: int) -> None:
    """
    Scheduled task to batch-generate LLM reports for all projects.
    Runs daily at the specified hour UTC. Processes per-entity for proper isolation.
    """
    from app.db_async import get_pool
    from uuid import UUID
    from app.services.llm_report_schedule import get_report_schedule
    
    while True:
        schedule = await get_report_schedule(report_type)
        if not schedule.get("enabled", True):
            await asyncio.sleep(3600)
            continue
        run_hour_utc = schedule.get("run_hour_utc", run_hour_utc)
        now = datetime.now(timezone.utc)
        next_run = now.replace(hour=run_hour_utc, minute=0, second=0, microsecond=0)
        if next_run <= now:
            next_run += timedelta(days=1)
        sleep_seconds = max(0, (next_run - now).total_seconds())
        await asyncio.sleep(sleep_seconds)
        try:
            schedule = await get_report_schedule(report_type)
            if not schedule.get("enabled", True):
                continue
            # Cleanup expired cache entries first
            deleted = cleanup_expired_cache()
            if deleted > 0:
                print(f"Cleaned up {deleted} expired LLM report cache entries")
            
            # Process per-entity for proper isolation
            pool = await get_pool()
            async with pool.acquire() as conn:
                entity_rows = await conn.fetch("SELECT id FROM entity ORDER BY id")
                total_success = 0
                total_cached = 0
                total_errors = 0
                total_processed = 0
                
                for entity_row in entity_rows:
                    entity_id = UUID(str(entity_row["id"]))
                    result = await batch_generate_reports(
                        force_all=True,
                        entity_id=entity_id,
                        report_types=[report_type],
                    )
                    if report_type == "governance_requirements_report":
                        summary = result.get("governance_requirements") or {}
                        total_success += summary.get("success_count", 0)
                        total_cached += summary.get("cached_count", 0)
                        total_errors += summary.get("error_count", 0)
                        total_processed += summary.get("total_processed", 0)
                    elif report_type == "board_level_report":
                        summary = result.get("board_level_report") or {}
                        total_success += summary.get("success_count", 0)
                        total_cached += summary.get("cached_count", 0)
                        total_errors += summary.get("error_count", 0)
                        total_processed += summary.get("total_processed", 0)
                    else:
                        total_success += result.get("success_count", 0)
                        total_cached += result.get("cached_count", 0)
                        total_errors += result.get("error_count", 0)
                        total_processed += result.get("total_processed", 0)
                
                print(
                    f"LLM report batch generation completed ({report_type}): "
                    f"{total_success} new reports generated, "
                    f"{total_cached} reports from cache, "
                    f"{total_errors} failed out of {total_processed} total projects "
                    f"across {len(entity_rows)} entities"
                )
        except Exception as exc:
            print(f"LLM report batch generation failed: {exc}")


async def _kpi_recompute_scheduler(run_hour_utc: int) -> None:
    """
    Scheduled task to run KPI (and pillar) recompute for all projects.
    Runs daily at the specified hour UTC. Logs each run to the audit log.
    """
    while True:
        now = datetime.now(timezone.utc)
        next_run = now.replace(hour=run_hour_utc, minute=0, second=0, microsecond=0)
        if next_run <= now:
            next_run += timedelta(days=1)
        sleep_seconds = max(0, (next_run - now).total_seconds())
        await asyncio.sleep(sleep_seconds)
        try:
            result = await recompute_all(project_id_or_none=None, pool=None, verbose=False)
            await append_audit_event(
                event_type="kpi_recompute.completed",
                source_service="core-svc",
                object_type="kpi_recompute",
                object_id="ALL",
                project_slug=None,
                details={
                    "scope": "ALL",
                    "trigger": "scheduled",
                    "status": result.get("status"),
                    "kpis": result.get("kpis"),
                    "pillars": result.get("pillars"),
                },
            )
            print(
                f"KPI recompute (scheduled) completed: kpis={result.get('kpis')}, pillars={result.get('pillars')}"
            )
        except Exception as exc:
            try:
                await append_audit_event(
                    event_type="kpi_recompute.failed",
                    source_service="core-svc",
                    object_type="kpi_recompute",
                    object_id="ALL",
                    project_slug=None,
                    details={"scope": "ALL", "trigger": "scheduled", "error": str(exc)},
                )
            except Exception:
                pass
            print(f"KPI recompute (scheduled) failed: {exc}")


async def _provenance_manifest_scheduler(run_hour_utc: int) -> None:
    """
    Scheduled task to build provenance manifests and evaluations for all projects.
    Runs daily at the specified hour UTC. Processes per-entity for proper isolation.
    """
    from app.db_async import get_pool
    from uuid import UUID
    
    while True:
        now = datetime.now(timezone.utc)
        next_run = now.replace(hour=run_hour_utc, minute=0, second=0, microsecond=0)
        if next_run <= now:
            next_run += timedelta(days=1)
        sleep_seconds = max(0, (next_run - now).total_seconds())
        await asyncio.sleep(sleep_seconds)
        try:
            # Process per-entity for proper isolation
            pool = await get_pool()
            async with pool.acquire() as conn:
                entity_rows = await conn.fetch("SELECT id FROM entity ORDER BY id")
                total_success = 0
                total_errors = 0
                total_processed = 0
                
                for entity_row in entity_rows:
                    entity_id = UUID(str(entity_row["id"]))
                    result = await batch_build_manifests(entity_id=entity_id)
                    total_success += result['success_count']
                    total_errors += result['error_count']
                    total_processed += result['total_processed']
                
                print(
                    f"Provenance manifest batch completed (all entities): "
                    f"{total_success} succeeded, "
                    f"{total_errors} failed out of {total_processed} total projects"
                )
        except Exception as exc:
            print(f"Provenance manifest batch failed: {exc}")


@app.on_event("startup")
def load_provenance_rules():
    try:
        load_rules_config()
    except (FileNotFoundError, ProvenanceRulesError) as exc:
        print(f"Provenance rules load failed: {exc}")


@app.on_event("startup")
async def seed_default_policies():
    try:
        inserted = await ensure_default_policies()
        if inserted:
            print(f"Seeded {inserted} default policies.")
    except Exception as exc:
        print(f"Default policy seed failed: {exc}")


@app.on_event("startup")
async def seed_eu_ai_act_requirements():
    try:
        inserted = await ensure_eu_ai_act_requirements()
        if inserted:
            print(f"Seeded {inserted} EU AI Act requirement rows.")
    except Exception as exc:
        print(f"EU AI Act seed failed: {exc}")


@app.on_event("startup")
async def start_governance_scheduler():
    mode = os.getenv("DATA_GOVERNANCE_SCHEDULER", "on").lower()
    if mode in ("0", "false", "off", "no"):
        return
    hour_raw = os.getenv("DATA_GOVERNANCE_DAILY_HOUR", "2")
    try:
        run_hour = max(0, min(23, int(hour_raw)))
    except ValueError:
        run_hour = 2
    app.state.governance_task = asyncio.create_task(
        _governance_scheduler(run_hour)
    )


@app.on_event("startup")
async def start_llm_report_batch_scheduler():
    """Start the scheduled LLM report batch generation task."""
    mode = os.getenv("LLM_REPORT_BATCH_SCHEDULER", "on").lower()
    if mode in ("0", "false", "off", "no"):
        return
    hour_raw = os.getenv("LLM_REPORT_BATCH_DAILY_HOUR", "3")
    try:
        run_hour = max(0, min(23, int(hour_raw)))
    except ValueError:
        run_hour = 3
    from app.services.llm_report_schedule import REPORT_TYPES

    app.state.llm_report_batch_tasks = [
        asyncio.create_task(_llm_report_batch_scheduler(report_type, run_hour))
        for report_type in REPORT_TYPES
    ]


@app.on_event("startup")
async def start_kpi_recompute_scheduler():
    """Start the scheduled KPI recompute task (daily batch)."""
    mode = os.getenv("KPI_RECOMPUTE_BATCH_SCHEDULER", "on").lower()
    if mode in ("0", "false", "off", "no"):
        return
    hour_raw = os.getenv("KPI_RECOMPUTE_DAILY_HOUR", "3")
    try:
        run_hour = max(0, min(23, int(hour_raw)))
    except ValueError:
        run_hour = 3
    app.state.kpi_recompute_task = asyncio.create_task(
        _kpi_recompute_scheduler(run_hour)
    )


@app.on_event("startup")
async def start_provenance_manifest_scheduler():
    """Start the scheduled provenance manifest builder task (daily batch)."""
    mode = os.getenv("PROVENANCE_MANIFEST_BATCH_SCHEDULER", "on").lower()
    if mode in ("0", "false", "off", "no"):
        return
    hour_raw = os.getenv("PROVENANCE_MANIFEST_DAILY_HOUR", "3")
    try:
        run_hour = max(0, min(23, int(hour_raw)))
    except ValueError:
        run_hour = 3
    app.state.provenance_manifest_task = asyncio.create_task(
        _provenance_manifest_scheduler(run_hour)
    )


@app.on_event("shutdown")
async def stop_governance_scheduler():
    task = getattr(app.state, "governance_task", None)
    if task:
        task.cancel()


@app.on_event("shutdown")
async def stop_llm_report_batch_scheduler():
    task = getattr(app.state, "llm_report_batch_task", None)
    if task:
        task.cancel()
    tasks = getattr(app.state, "llm_report_batch_tasks", None)
    if tasks:
        for task in tasks:
            task.cancel()


@app.on_event("shutdown")
async def stop_kpi_recompute_scheduler():
    task = getattr(app.state, "kpi_recompute_task", None)
    if task:
        task.cancel()


@app.on_event("shutdown")
async def stop_provenance_manifest_scheduler():
    task = getattr(app.state, "provenance_manifest_task", None)
    if task:
        task.cancel()


# End of file
