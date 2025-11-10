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

from app.db import ping_db
from app.scorecard import router as scorecard_router
from app.routers.trends import router as trends_router
from app.routers.projects import router as projects_router
from app.routers.admin import router as admin_router

# --- Debug aid: see which scorecard modules were loaded at startup ------------
# Tip: Comment out or guard with `if os.getenv("DEBUG"):` in production.
import sys
print(">>> LOADED modules containing 'scorecard':",
      [m for m in sys.modules if "scorecard" in m])

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

# --- Mount feature routers ----------------------------------------------------
# Keep these grouped and explicit to make API surface obvious.
# Each router carries its own prefix and tags.
app.include_router(scorecard_router)  # /scorecard: scorecards, pillars, controls, updates
app.include_router(trends_router)     # /scorecard/.../trends: time-series derived from history
app.include_router(projects_router)   # /projects: list/delete projects
app.include_router(admin_router)      # /admin: control CRUD, evidence, imports/exports

# End of file
