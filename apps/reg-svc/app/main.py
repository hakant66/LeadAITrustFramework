from fastapi import FastAPI

from app.db import ping_db
from app.routers.trust_decay import router as trust_decay_router

app = FastAPI(
    title="LeadAI Regulatory Service",
    description="Signal ingestion and trust decay processing.",
    version="0.1.0",
)


@app.get("/healthz")
def healthz():
    ok = ping_db()
    return {"status": "ok" if ok else "fail", "postgres": ok}


app.include_router(trust_decay_router)
