# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db import ping_db
from app.scorecard import router as scorecard_router
from app.routers.trends import router as trends_router
from app.routers.projects import router as projects_router
from app.routers.admin import router as admin_router

import sys
print(">>> LOADED modules containing 'scorecard':",
      [m for m in sys.modules if "scorecard" in m])

app = FastAPI(title="LeadAI Core Service")

# CORS: allow local Next.js/React dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/healthz")
def healthz():
    ok = ping_db()
    return {"status": "ok" if ok else "fail", "postgres": ok}

# Mount routers
app.include_router(scorecard_router)
app.include_router(trends_router)
app.include_router(projects_router)
app.include_router(admin_router)
