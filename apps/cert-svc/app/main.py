from fastapi import FastAPI

from app.db import ping_db
from app.routers.trustmark import router as trustmark_router

app = FastAPI(
    title="LeadAI TrustMark Registry",
    description="TrustMark issuance and public verification API.",
    version="0.1.0",
)


@app.get("/healthz")
def healthz():
    ok = ping_db()
    return {"status": "ok" if ok else "fail", "postgres": ok}


app.include_router(trustmark_router)
