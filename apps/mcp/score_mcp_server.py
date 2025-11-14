# apps/mcp/score_mcp_server.py
"""
LeadAI MCP stdio server exposing scoring tools that call Python functions directly.

Tools:
  - recompute_kpis     {project?: str, verbose?: bool}
  - recompute_pillars  {project?: str, verbose?: bool}
  - recompute_all      {project?: str, verbose?: bool}

Run (stdio):
  python apps/mcp/score_mcp_server.py
"""
from __future__ import annotations

import os
import sys
from typing import Optional, Dict, Any

# --- Ensure repo imports work when launched from anywhere ---------------------
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CORE_APP = os.path.join(REPO_ROOT, "apps", "core-svc")  # <-- hyphenated folder

if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)
if CORE_APP not in sys.path:
    sys.path.insert(0, CORE_APP)
    
# ---- Internal scoring APIs (your wrappers) -----------------------------------
#   - score_engine.py must expose:
#   - compute_kpi_scores(project_id_or_none, pool=None, verbose=False)
#   - compute_pillar_scores(project_id_or_none, pool=None, verbose=False)
#   - recompute_all(project_id_or_none, pool=None, verbose=False)
from app.score_engine import compute_kpi_scores, compute_pillar_scores, recompute_all
from app.app_db import get_pool, get_project_id_by_slug, init_pool

from dotenv import load_dotenv
load_dotenv()

# ---- MCP SDK (pip install -U mcp) -------------------------------------------
try:
    from mcp.server import Server
    from mcp.types import Tool, TextContent, CallToolRequest, CallToolResult
except Exception as e:  # pragma: no cover
    raise RuntimeError("Missing or outdated 'mcp' package. Install via: pip install -U mcp") from e

# DB helpers (renamed to avoid clashing with your real scorecard.py)
from app.app_db import get_pool, get_project_id_by_slug, init_pool

# -----------------------------------------------------------------------------

server = Server("leadai-score-server")

# --------------------------- Tool handlers -----------------------------------

def _get_args(req: CallToolRequest) -> Dict[str, Any]:
    """MCP >=1.1 uses 'arguments'. Be lenient if a client still sends 'params'."""
    args = {}
    if hasattr(req, "arguments") and isinstance(req.arguments, dict):
        args = req.arguments
    elif hasattr(req, "params") and isinstance(getattr(req, "params"), dict):  # legacy clients
        args = getattr(req, "params")
    return args

# === recompute_kpis ===========================================================
@server.tool(
    name="recompute_kpis",
    description="Recompute KPI scores (normalized_pct + kpi_score) for a project or all projects.",
    input_schema={
        "type": "object",
        "properties": {
            "project": {"type": "string", "description": "Project slug; omit for ALL."},
            "verbose": {"type": "boolean", "default": False},
        },
    },
)
async def handle_kpis(req: CallToolRequest) -> CallToolResult:
    args = _get_args(req)
    project_slug = args.get("project")
    verbose = bool(args.get("verbose", False))
    pool = get_pool() or await init_pool()
    if project_slug:
        pid = await get_project_id_by_slug(project_slug)
        if not pid:
            return CallToolResult(content=[TextContent(text=f"project not found: {project_slug}")], isError=True)
        out = await compute_kpi_scores(pid, pool=pool, verbose=verbose)
        return CallToolResult(content=[TextContent(text=f"KPI recompute ok for {project_slug}: {out}")])
    else:
        out = await compute_kpi_scores(None, pool=pool, verbose=verbose)
        return CallToolResult(content=[TextContent(text=f"KPI recompute ok for ALL: {out}")])
                
# === recompute_pillars ========================================================
@server.tool(
    name="recompute_pillars",
    description="Recompute pillar scores and apply guardrails/weights for a project or all projects.",
    input_schema={
        "type": "object",
        "properties": {
            "project": {"type": "string", "description": "Project slug; omit for ALL."},
            "verbose": {"type": "boolean", "default": False},
        },
    },
)
async def handle_pillars(req: CallToolRequest) -> CallToolResult:
    args = _get_args(req)
    project_slug = args.get("project")
    verbose = bool(args.get("verbose", False))
    pool = get_pool() or await init_pool()
    if project_slug:
        pid = await get_project_id_by_slug(project_slug)
        if not pid:
            return CallToolResult(content=[TextContent(text=f"project not found: {project_slug}")], isError=True)
        out = await compute_pillar_scores(pid, pool=pool, verbose=verbose)
        return CallToolResult(content=[TextContent(text=f"Pillar recompute ok for {project_slug}: {out}")])
    else:
        out = await compute_pillar_scores(None, pool=pool, verbose=verbose)
        return CallToolResult(content=[TextContent(text=f"Pillar recompute ok for ALL: {out}")])

# === recompute_all ============================================================
@server.tool(
    name="recompute_all",
    description="Run KPI then pillar recomputation (uses advisory lock per project when scoped).",
    input_schema={
        "type": "object",
        "properties": {
            "project": {"type": "string", "description": "Project slug; omit for ALL."},
            "verbose": {"type": "boolean", "default": False},
        },
    },
)
async def handle_all(req: CallToolRequest) -> CallToolResult:
    args = _get_args(req)
    project_slug = args.get("project")
    verbose = bool(args.get("verbose", False))
    pool = get_pool() or await init_pool()

    pid = None
    if project_slug:
        pid = await get_project_id_by_slug(project_slug)
        if not pid:
            return CallToolResult(content=[TextContent(text=f"project not found: {project_slug}")], isError=True)

    out = await recompute_all(pid, pool=pool, verbose=verbose)
    return CallToolResult(content=[TextContent(text=f"Full recompute ok for {project_slug or 'ALL'}: {out}")])

# ---------------------------- Entrypoint --------------------------------------
if __name__ == "__main__":
    # Ensure the async DB pool exists before handling requests
    import asyncio
    asyncio.run(init_pool())
    # JSON-RPC over stdio
    server.run_stdio()
