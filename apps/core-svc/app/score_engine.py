# apps/core-svc/app/score_engine.py
"""
Async scoring wrappers so FastAPI, MCP, or other callers can trigger recomputes
without spawning subprocesses.

Exposed APIs (all async):
  - compute_kpi_scores(project_id_or_none, pool=None, verbose=False) -> dict
  - compute_pillar_scores(project_id_or_none, pool=None, verbose=False) -> dict
  - recompute_all(project_id_or_none, pool=None, verbose=False) -> dict

Behavior:
  * If 'project_id_or_none' is a string, we take a Postgres advisory lock to
    serialize recomputes per project (across processes that also use this API).
  * Calls the existing modules' run(...) functions in a worker thread:
      - app.leadai_compute_kpi_scores.run(project_filter, dry_run=False, verbose=False)
      - app.leadai_compute_pillar_scores.run(project_filter, verbose=False)  # adjust if needed
  * Returns small JSON summaries for UI/logging.
"""

from __future__ import annotations

import os
import sys
from contextlib import contextmanager
from typing import Optional, Dict, Any, Tuple

import anyio
import psycopg
from dotenv import load_dotenv

# Ensure repo-relative imports work when launched from various entrypoints
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

load_dotenv()
DB_URL = os.getenv("DATABASE_URL", "postgresql://leadai:leadai@localhost:5432/leadai")

# Import your existing scripts (module-local run(...) functions)
try:
    import app.leadai_compute_kpi_scores as kpi_mod
except Exception:
    kpi_mod = None  # type: ignore

try:
    import app.leadai_compute_pillar_scores as pillar_mod
except Exception:
    pillar_mod = None  # type: ignore


# --------------------------- Locking utilities -------------------------------

def _advisory_key(project_id: str) -> int:
    """Map project_id to a stable 31-bit integer key for pg advisory locks."""
    return abs(hash(project_id)) & 0x7FFFFFFF


@contextmanager
def _project_advisory_lock(project_id: str):
    """
    Context manager that tries to take a session-level advisory lock.
    If it cannot acquire the lock, yields ('skipped', None) and returns early.
    Otherwise yields ('ok', conn) with an open psycopg connection that holds
    the lock for the duration of the context.
    """
    conn = psycopg.connect(DB_URL, autocommit=False)
    try:
        key = _advisory_key(project_id)
        got = conn.execute("SELECT pg_try_advisory_lock(%s)", (key,)).fetchone()[0]
        if not got:
            # Do not close conn yet; just release without holding anything.
            try:
                conn.close()
            finally:
                yield ("skipped", None)
                return
        # Lock is held on this session
        yield ("ok", conn)
        # no commit here; scripts manage their own transactions
    finally:
        try:
            # Best-effort unlock; if not held, this is a no-op
            try:
                conn.execute("SELECT pg_advisory_unlock_all()")
            except Exception:
                pass
        finally:
            try:
                conn.close()
            except Exception:
                pass


# --------------------------- Thread helpers ----------------------------------

async def _run_in_thread(fn, *args, **kwargs):
    """Run a sync function in a worker thread and return its result."""
    return await anyio.to_thread.run_sync(lambda: fn(*args, **kwargs))


# --------------------------- Public APIs -------------------------------------

async def compute_kpi_scores(
    project_id_or_none: Optional[str],
    pool=None,
    verbose: bool = False,
) -> Dict[str, Any]:
    """
    Recompute KPI-level values (normalized_pct, kpi_score).
    Returns: {"scope": "...", "updated": int, "skipped": int, "status": "..."}
    """
    if kpi_mod is None or not hasattr(kpi_mod, "run"):
        return {"scope": project_id_or_none or "ALL", "status": "error", "message": "leadai_compute_kpi_scores.run not found"}

    scope = project_id_or_none or "ALL"

    # Project-scoped: take an advisory lock to serialize across callers
    if project_id_or_none:
        with _project_advisory_lock(project_id_or_none) as (state, _conn):
            if state != "ok":
                return {"scope": scope, "status": "skipped", "reason": "already running"}
            # Call the script's run(project_filter, dry_run=False, verbose=...)
            updated, skipped = await _run_in_thread(kpi_mod.run, project_id_or_none, False, verbose)
            return {"scope": scope, "status": "ok", "updated": updated, "skipped": skipped}

    # All-projects mode (no lock; implement a coarse global lock if you need it)
    updated, skipped = await _run_in_thread(kpi_mod.run, None, False, verbose)
    return {"scope": scope, "status": "ok", "updated": updated, "skipped": skipped}


async def compute_pillar_scores(
    project_id_or_none: Optional[str],
    pool=None,
    verbose: bool = False,
) -> Dict[str, Any]:
    """
    Recompute pillar scores (apply caps/targets/weights).
    Returns: {"scope": "...", "updated": int, "skipped": int, "status": "..."}
    """
    if pillar_mod is None or not hasattr(pillar_mod, "run"):
        return {"scope": project_id_or_none or "ALL", "status": "error", "message": "leadai_compute_pillar_scores.run not found"}

    scope = project_id_or_none or "ALL"

    def _invoke_pillar_run(project):
        """
        Support both:
            run(project_filter, verbose=...)
        and legacy:
            run(project_filter)
        """
        try:
            return pillar_mod.run(project, verbose=verbose)
        except TypeError:
            return pillar_mod.run(project)

    if project_id_or_none:
        with _project_advisory_lock(project_id_or_none) as (state, _conn):
            if state != "ok":
                return {"scope": scope, "status": "skipped", "reason": "already running"}
            updated, skipped = await _run_in_thread(_invoke_pillar_run, project_id_or_none)
            return {"scope": scope, "status": "ok", "updated": updated, "skipped": skipped}

    updated, skipped = await _run_in_thread(_invoke_pillar_run, None)
    return {"scope": scope, "status": "ok", "updated": updated, "skipped": skipped}


async def recompute_all(
    project_id_or_none: Optional[str],
    pool=None,
    verbose: bool = False,
) -> Dict[str, Any]:
    """
    Run KPI recompute followed by pillar recompute.
    When project-scoped, both steps are serialized under the same advisory lock.
    Returns a merged summary dict.
    """
    scope = project_id_or_none or "ALL"

    if project_id_or_none:
        with _project_advisory_lock(project_id_or_none) as (state, _conn):
            if state != "ok":
                return {"scope": scope, "status": "skipped", "reason": "already running"}
            k = await compute_kpi_scores(project_id_or_none, pool=pool, verbose=verbose)
            p = await compute_pillar_scores(project_id_or_none, pool=pool, verbose=verbose)
            return {"scope": scope, "status": "ok", "kpis": k, "pillars": p}

    # ALL projects (no lock)
    k = await compute_kpi_scores(None, pool=pool, verbose=verbose)
    p = await compute_pillar_scores(None, pool=pool, verbose=verbose)
    return {"scope": scope, "status": "ok", "kpis": k, "pillars": p}
