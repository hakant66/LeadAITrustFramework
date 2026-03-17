from __future__ import annotations

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel

from app.settings import settings
from app.services.trustmark import (
    issue_trustmark,
    revoke_trustmark,
    verify_trustmark,
    audit_view,
    list_trustmarks,
    latest_trustmark,
)


router = APIRouter(prefix="/trustmark", tags=["trustmark"])


class IssueResp(BaseModel):
    trustmark: dict
    signature: str
    public_key: str


class RevokeIn(BaseModel):
    reason: str | None = None


@router.post("/issue/{project_slug}", response_model=IssueResp)
def issue(project_slug: str, expires_days: int = 30):
    try:
        return issue_trustmark(project_slug, expires_days=expires_days)
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/revoke/{trustmark_id}")
def revoke(trustmark_id: str, body: RevokeIn):
    revoke_trustmark(trustmark_id, reason=body.reason)
    return {"ok": True, "id": trustmark_id, "status": "revoked"}


@router.get("/verify/{trustmark_id}")
def verify(trustmark_id: str):
    return verify_trustmark(trustmark_id)


@router.get("/list")
def list_items(
    project_slug: str | None = None,
    status: str | None = None,
    q: str | None = None,
    limit: int = 50,
    offset: int = 0,
):
    return list_trustmarks(
        project_slug=project_slug,
        status=status,
        q=q,
        limit=limit,
        offset=offset,
    )


@router.get("/latest/{project_slug}")
def latest(project_slug: str):
    return latest_trustmark(project_slug)


@router.get("/audit/{trustmark_id}")
def audit(trustmark_id: str, x_auditor_token: str | None = Header(default=None)):
    if settings.auditor_token and x_auditor_token != settings.auditor_token:
        raise HTTPException(status_code=403, detail="forbidden")
    return audit_view(trustmark_id)
