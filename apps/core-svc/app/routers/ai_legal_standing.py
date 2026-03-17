import asyncio
import json
from typing import Any, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.routers.entity import _get_pool
from app.services.eu_ai_act_assessment import EUAIAssessment, EUAIAssessmentInput

router = APIRouter(prefix="/ai-legal-standing", tags=["ai-legal-standing"])
_submission_table_initialized = False
_submission_table_lock = asyncio.Lock()


class AssessmentRequest(BaseModel):
    provider: bool
    deployer: bool
    importer: bool
    distributor: bool
    authorized_representative: bool
    substantial_modifier: bool
    product_manufacturer: bool
    non_eu_rep_appointed: bool
    distributor_access: bool
    importer_non_original: bool
    provide_as_is: bool
    in_scope_ai: bool
    prohibited_practices: bool
    safety_component: bool
    annex_iii_sensitive: bool
    narrow_procedural: bool
    profiling: bool


class AssessmentSubmissionCreate(BaseModel):
    firstName: str
    lastName: str
    email: str
    company: Optional[str] = None
    answers: AssessmentRequest
    result: dict[str, Any]
    entityId: Optional[UUID] = None


async def _ensure_submissions_table() -> None:
    global _submission_table_initialized
    if _submission_table_initialized:
        return
    async with _submission_table_lock:
        if _submission_table_initialized:
            return
        pool = await _get_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                """
                CREATE TABLE IF NOT EXISTS ai_legal_standing_submissions (
                    id UUID PRIMARY KEY,
                    entity_id UUID NULL REFERENCES entity(id) ON DELETE SET NULL,
                    first_name TEXT NOT NULL,
                    last_name TEXT NOT NULL,
                    email TEXT NOT NULL,
                    company TEXT NULL,
                    answers JSONB NOT NULL,
                    result JSONB NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
                )
                """
            )
            await conn.execute(
                """
                CREATE INDEX IF NOT EXISTS ix_ai_legal_standing_submissions_created_at
                ON ai_legal_standing_submissions (created_at DESC)
                """
            )
            await conn.execute(
                """
                CREATE INDEX IF NOT EXISTS ix_ai_legal_standing_submissions_email
                ON ai_legal_standing_submissions (email)
                """
            )
        _submission_table_initialized = True


@router.get("/health")
def health():
    return {"status": "ok"}


@router.post("/assess")
def assess(payload: AssessmentRequest):
    assessment_input = EUAIAssessmentInput(**payload.model_dump())
    result = EUAIAssessment(assessment_input).evaluate()
    return result


@router.post("/submissions")
async def create_submission(payload: AssessmentSubmissionCreate):
    await _ensure_submissions_table()
    pool = await _get_pool()
    submission_id = uuid4()
    first_name = payload.firstName.strip()
    last_name = payload.lastName.strip()
    email = payload.email.strip()
    company = payload.company.strip() if payload.company else None
    if not first_name or not last_name or not email:
        raise HTTPException(
            status_code=400,
            detail="firstName, lastName and email are required.",
        )
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO ai_legal_standing_submissions (
                id, entity_id, first_name, last_name, email, company, answers, result
            ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)
            """,
            submission_id,
            payload.entityId,
            first_name,
            last_name,
            email,
            company,
            json.dumps(payload.answers.model_dump()),
            json.dumps(payload.result),
        )
    return {"id": str(submission_id), "stored": True}
