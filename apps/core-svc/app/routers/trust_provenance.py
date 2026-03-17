from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.services.provenance_rules import (
    ProvenanceRulesError,
    evaluate_provenance,
    load_rules_config,
)
from app.services.trust_eval import TrustEvalError, evaluate_provenance_hybrid


router = APIRouter(prefix="/trust/provenance", tags=["trust-provenance"])


class ProvenanceEvaluateRequest(BaseModel):
    manifest_facts: Dict[str, Any]


class ProvenanceFieldOut(BaseModel):
    field: str
    level: str
    score: int
    matched_rule: Optional[str] = None
    reasons: List[Dict[str, Any]]
    debug: Optional[Dict[str, Any]] = None


class ProvenanceGateOut(BaseModel):
    gate_id: str
    forced_level: str
    reasons: List[Dict[str, Any]]
    debug: Optional[Dict[str, Any]] = None


class ProvenanceOverallOut(BaseModel):
    level: str
    score: int
    forced: bool
    reasons: List[Dict[str, Any]]
    debug: Optional[Dict[str, Any]] = None


class ProvenanceEvaluateResponse(BaseModel):
    overall: ProvenanceOverallOut
    fields: List[ProvenanceFieldOut]
    gates: List[ProvenanceGateOut]
    debug: Optional[Dict[str, Any]] = None


@router.post("/evaluate", response_model=ProvenanceEvaluateResponse)
async def evaluate_provenance_endpoint(
    payload: ProvenanceEvaluateRequest,
    debug: bool = Query(False, description="Include debug traces"),
    source: str = Query("auto", description="Evaluation source: auto or local"),
):
    try:
        if source.strip().lower() == "local":
            return evaluate_provenance(
                payload.manifest_facts,
                include_debug=debug,
                rules=load_rules_config(),
            )
        return await evaluate_provenance_hybrid(
            payload.manifest_facts,
            include_debug=debug,
        )
    except ProvenanceRulesError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except TrustEvalError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
