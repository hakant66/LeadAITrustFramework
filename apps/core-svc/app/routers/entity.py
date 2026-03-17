"""
Entity profile API: persist data captured at /entity into leadai DB.

Tables: entity_country, entity_sector_lookup, entity_primary_role (lookups), entity_risk_class (lookup), entity (main),
entity_region, entity_sector (junctions). Also: profile-from-url (Search → Scrape → Structure).
"""
from __future__ import annotations

import asyncio
import json
import os
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID

import asyncpg
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

try:
    from app.services.company_profile_from_url import profile_company_from_url, check_llm_config, _CANONICAL_COUNTRIES, _COUNTRY_ALIASES
except ImportError:
    profile_company_from_url = None
    check_llm_config = None
    _CANONICAL_COUNTRIES = frozenset()
    _COUNTRY_ALIASES = {}

try:
    from app.services.audit_log import append_audit_event
except ImportError:
    append_audit_event = None

router = APIRouter(prefix="/entity", tags=["entity"])

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://leadai:leadai@localhost:5432/leadai",
)

_pool: Optional[asyncpg.Pool] = None


async def _get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        dsn = DATABASE_URL.replace("+asyncpg", "").replace("+psycopg", "")
        try:
            _pool = await asyncpg.create_pool(dsn=dsn, min_size=1, max_size=10)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"DB connection failed: {e}")
    return _pool


def _normalize_locale(locale: Optional[str]) -> Optional[str]:
    if not locale:
        return None
    normalized = locale.strip().lower()
    if not normalized:
        return None
    return normalized.split(",")[0].split("-")[0]


def _parse_json_field(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, (dict, list)):
        return value
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return None
    return value


async def _get_entity_translation(
    conn: asyncpg.Connection, entity_id: UUID, locale: Optional[str]
) -> Optional[asyncpg.Record]:
    normalized = _normalize_locale(locale)
    if not normalized:
        return None
    return await conn.fetchrow(
        """
        SELECT full_legal_name, legal_form, regions_other, sector_other,
               employee_count, annual_turnover, decision_trace,
               authorized_representative_name, ai_compliance_officer_name,
               executive_sponsor_name
        FROM entity_translations
        WHERE entity_id = $1 AND locale = $2
        """,
        entity_id,
        normalized,
    )


async def _get_or_create_country(conn: asyncpg.Connection, name: str) -> Optional[UUID]:
    if not name or not name.strip():
        return None
    row = await conn.fetchrow(
        "SELECT id FROM entity_country WHERE name = $1", name.strip()
    )
    if row:
        return row["id"]
    row = await conn.fetchrow(
        "INSERT INTO entity_country (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id",
        name.strip(),
    )
    return row["id"] if row else None


def _validate_other_country(country_name: str) -> Tuple[bool, Optional[str]]:
    """
    Validate an "Other" country name. Returns (is_valid, error_message_or_suggestion).
    If valid, returns (True, None). If invalid, returns (False, error_message_with_suggestion).
    """
    if not country_name or not country_name.strip():
        return (True, None)  # Empty is allowed
    
    normalized = country_name.strip()
    normalized_lower = normalized.lower()
    
    # Check if it's already in the canonical list (case-insensitive)
    for canonical in _CANONICAL_COUNTRIES:
        if canonical.lower() == normalized_lower:
            return (False, f'"{normalized}" matches "{canonical}" which is already available in the list. Please select "{canonical}" from the list instead.')
    
    # Check aliases
    if normalized_lower in _COUNTRY_ALIASES:
        canonical = _COUNTRY_ALIASES[normalized_lower]
        return (False, f'"{normalized}" matches "{canonical}" which is already available in the list. Please select "{canonical}" from the list instead.')
    
    # Check for substring matches (fuzzy)
    for canonical in _CANONICAL_COUNTRIES:
        canonical_lower = canonical.lower()
        if normalized_lower in canonical_lower or canonical_lower in normalized_lower:
            return (False, f'Did you mean "{canonical}"? Please check the spelling or select it from the list.')
    
    # Simple Levenshtein-like check for close matches
    for canonical in _CANONICAL_COUNTRIES:
        canonical_lower = canonical.lower()
        # Check if strings are similar (within 2 character difference for short names, 3 for longer)
        max_diff = 2 if len(normalized) < 10 else 3
        if abs(len(normalized_lower) - len(canonical_lower)) <= max_diff:
            # Simple similarity check
            common_chars = sum(1 for c in normalized_lower if c in canonical_lower)
            similarity = common_chars / max(len(normalized_lower), len(canonical_lower))
            if similarity > 0.7:  # 70% similarity threshold
                return (False, f'Did you mean "{canonical}"? Please check the spelling or select it from the list.')
    
    # If no close match found, accept it (might be a valid country not in our list)
    return (True, None)


async def _get_or_create_sector(conn: asyncpg.Connection, name: str) -> Optional[UUID]:
    if not name or not name.strip():
        return None
    row = await conn.fetchrow(
        "SELECT id FROM entity_sector_lookup WHERE name = $1", name.strip()
    )
    if row:
        return row["id"]
    row = await conn.fetchrow(
        "INSERT INTO entity_sector_lookup (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id",
        name.strip(),
    )
    return row["id"] if row else None


async def _get_or_create_primary_role(conn: asyncpg.Connection, name: str) -> Optional[UUID]:
    if not name or not name.strip():
        return None
    row = await conn.fetchrow(
        "SELECT id FROM entity_primary_role WHERE name = $1", name.strip()
    )
    if row:
        return row["id"]
    row = await conn.fetchrow(
        "INSERT INTO entity_primary_role (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id",
        name.strip(),
    )
    return row["id"] if row else None


async def _get_or_create_risk_class(conn: asyncpg.Connection, name: str) -> Optional[UUID]:
    if not name or not name.strip():
        return None
    row = await conn.fetchrow(
        "SELECT id FROM entity_risk_class WHERE name = $1", name.strip()
    )
    if row:
        return row["id"]
    row = await conn.fetchrow(
        "INSERT INTO entity_risk_class (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id",
        name.strip(),
    )
    return row["id"] if row else None


# Request/response models aligned with frontend EntityProfile (camelCase accepted)
class EntityProfileCreate(BaseModel):
    fullLegalName: str = Field(..., min_length=1)
    legalForm: Optional[str] = None
    companyRegistrationNumber: Optional[str] = None
    headquartersCountry: str = Field(..., min_length=1)
    website: Optional[str] = None
    regionsOfOperation: List[str] = Field(default_factory=list)
    regionsOther: Optional[str] = None
    sectors: List[str] = Field(default_factory=list)
    sectorOther: Optional[str] = None
    employeeCount: Optional[str] = None
    annualTurnover: Optional[str] = None
    marketRole: Optional[str] = None  # deprecated: use primaryRole (from assessment)
    primaryRole: Optional[str] = None  # from EU AI Act assessment (Save Entity Information)
    riskClassification: Optional[str] = None  # from assessment
    decisionTrace: Optional[str] = None  # from assessment (text)
    legalStandingResult: Optional[Dict[str, Any]] = None  # assessment summary payload
    authorizedRepresentativeName: Optional[str] = None
    authorizedRepresentativeEmail: Optional[str] = None
    authorizedRepresentativePhone: Optional[str] = None
    aiComplianceOfficerName: Optional[str] = None
    aiComplianceOfficerEmail: Optional[str] = None
    executiveSponsorName: Optional[str] = None
    executiveSponsorEmail: Optional[str] = None


class EntityProfileResponse(BaseModel):
    id: str
    full_legal_name: str
    slug: Optional[str] = None
    created_at: Optional[str] = None


class EntityProfileUpdate(BaseModel):
    """Editable fields for Entity Setup page (excludes website, fullLegalName, legalForm)."""
    companyRegistrationNumber: Optional[str] = None
    headquartersCountry: Optional[str] = None
    regionsOfOperation: Optional[List[str]] = None
    regionsOther: Optional[str] = None
    sectors: Optional[List[str]] = None
    sectorOther: Optional[str] = None
    employeeCount: Optional[str] = None
    annualTurnover: Optional[str] = None
    primaryRole: Optional[str] = None
    riskClassification: Optional[str] = None
    decisionTrace: Optional[str] = None
    legalStandingResult: Optional[Dict[str, Any]] = None
    authorizedRepresentativeName: Optional[str] = None
    authorizedRepresentativeEmail: Optional[str] = None
    authorizedRepresentativePhone: Optional[str] = None
    aiComplianceOfficerName: Optional[str] = None
    aiComplianceOfficerEmail: Optional[str] = None
    executiveSponsorName: Optional[str] = None
    executiveSponsorEmail: Optional[str] = None


class EntityProfileFull(BaseModel):
    """Full entity profile for GET (Entity Setup page)."""
    id: str
    slug: Optional[str] = None
    fullLegalName: str
    legalForm: Optional[str] = None
    companyRegistrationNumber: Optional[str] = None
    headquartersCountry: Optional[str] = None
    website: Optional[str] = None
    regionsOfOperation: List[str] = Field(default_factory=list)
    regionsOther: Optional[str] = None
    sectors: List[str] = Field(default_factory=list)
    sectorOther: Optional[str] = None
    employeeCount: Optional[str] = None
    annualTurnover: Optional[str] = None
    primaryRole: Optional[str] = None
    riskClassification: Optional[str] = None
    decisionTrace: Optional[str] = None
    legalStandingResult: Optional[Dict[str, Any]] = None
    authorizedRepresentativeName: Optional[str] = None
    authorizedRepresentativeEmail: Optional[str] = None
    authorizedRepresentativePhone: Optional[str] = None
    aiComplianceOfficerName: Optional[str] = None
    aiComplianceOfficerEmail: Optional[str] = None
    executiveSponsorName: Optional[str] = None
    executiveSponsorEmail: Optional[str] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


class ProfileFromUrlRequest(BaseModel):
    url: str = Field(..., min_length=5)


_executor: Optional[ThreadPoolExecutor] = None


def _get_executor() -> ThreadPoolExecutor:
    global _executor
    if _executor is None:
        _executor = ThreadPoolExecutor(max_workers=2)
    return _executor


@router.get("/health")
async def health():
    return {"status": "ok"}


@router.get("/check-llm")
async def get_check_llm() -> Dict[str, Any]:
    """
    Verify that the LLM used for entity profile-from-URL (OpenAI or Gemini) is configured and reachable.
    Call this to confirm OPENAI_API_KEY or GEMINI_API_KEY works before using the Search button.
    """
    if check_llm_config is None:
        raise HTTPException(
            status_code=501,
            detail="check_llm not available (optional deps not installed).",
        )
    loop = asyncio.get_event_loop()
    try:
        result = await loop.run_in_executor(_get_executor(), check_llm_config)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    return result


@router.get("/llm-health")
async def get_llm_health() -> Dict[str, Any]:
    """
    Check if LLM API (OpenAI or Gemini) is configured and working.
    Used by frontend to determine if AI Search button should be enabled.
    Returns {"ok": True, "provider": "openai"|"gemini"} or {"ok": False, "error": "..."}.
    """
    if check_llm_config is None:
        return {"ok": False, "error": "LLM check not available"}
    loop = asyncio.get_event_loop()
    try:
        result = await loop.run_in_executor(_get_executor(), check_llm_config)
        return result
    except Exception as e:
        return {"ok": False, "error": str(e)}


@router.post("/profile-from-url")
async def post_profile_from_url(body: ProfileFromUrlRequest) -> Dict[str, Any]:
    """
    Search → Scrape → Structure: discover legal pages, scrape content, extract
    company profile with OpenAI (preferred) or Gemini. Returns partial entity profile for form pre-fill.
    Requires SERPER_API_KEY; FIRECRAWL_API_KEY optional; OPENAI_API_KEY or GEMINI_API_KEY for structuring.
    """
    if profile_company_from_url is None:
        raise HTTPException(
            status_code=501,
            detail="Profile-from-URL not available (install google-generativeai, firecrawl-py).",
        )
    loop = asyncio.get_event_loop()
    try:
        result = await loop.run_in_executor(
            _get_executor(),
            profile_company_from_url,
            body.url.strip(),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    if result.get("_error"):
        # 503 when extraction is unavailable due to missing API key
        if result.get("_code") == "CONFIG_MISSING":
            raise HTTPException(status_code=503, detail=result["_error"])
        raise HTTPException(status_code=422, detail=result["_error"])
    return result


def _primary_role_from_profile(profile: EntityProfileCreate) -> Optional[str]:
    return (profile.primaryRole or profile.marketRole or "").strip() or None


def _generate_entity_slug(full_legal_name: str) -> str:
    """Generate a URL-safe slug from full legal name."""
    import re
    # Convert to lowercase and replace non-alphanumeric with hyphens
    slug = re.sub(r'[^a-zA-Z0-9]+', '-', full_legal_name.strip().lower())
    # Remove leading/trailing hyphens
    slug = slug.strip('-')
    # Limit length to 120 characters (matching project_slug)
    if len(slug) > 120:
        slug = slug[:120].rstrip('-')
    return slug


async def _ensure_unique_entity_slug(conn: asyncpg.Connection, base_slug: str) -> str:
    """Ensure entity slug is unique by appending number if needed."""
    slug = base_slug
    counter = 1
    while True:
        existing = await conn.fetchval(
            "SELECT id FROM entity WHERE slug = $1",
            slug
        )
        if not existing:
            return slug
        slug = f"{base_slug}-{counter}"
        counter += 1
        # Safety limit
        if counter > 1000:
            raise HTTPException(
                status_code=500,
                detail="Unable to generate unique entity slug"
            )


@router.post("", response_model=EntityProfileResponse)
async def create_entity(profile: EntityProfileCreate) -> EntityProfileResponse:
    """Persist entity profile from /entity form or Save Entity Information (with assessment data)."""
    pool = await _get_pool()
    async with pool.acquire() as conn:
        hq_country_id = await _get_or_create_country(conn, profile.headquartersCountry)
        if not hq_country_id:
            raise HTTPException(
                status_code=400,
                detail="headquartersCountry is required",
            )

        primary_role_id = None
        if _primary_role_from_profile(profile):
            primary_role_id = await _get_or_create_primary_role(conn, _primary_role_from_profile(profile))

        risk_classification_id = None
        if (profile.riskClassification or "").strip():
            risk_classification_id = await _get_or_create_risk_class(conn, profile.riskClassification.strip())

        # Validate regionsOther if provided
        if profile.regionsOther and profile.regionsOther.strip():
            is_valid, error_msg = _validate_other_country(profile.regionsOther.strip())
            if not is_valid:
                raise HTTPException(status_code=400, detail=error_msg or "Invalid country name in 'Other' field")

        region_ids: List[UUID] = []
        for r in profile.regionsOfOperation:
            if r and r.strip() and r.strip().lower() != "other":
                cid = await _get_or_create_country(conn, r.strip())
                if cid and cid not in region_ids:
                    region_ids.append(cid)

        sector_ids: List[UUID] = []
        for s in profile.sectors:
            if s and s.strip():
                sid = await _get_or_create_sector(conn, s.strip())
                if sid and sid not in sector_ids:
                    sector_ids.append(sid)

        decision_trace_val = (profile.decisionTrace or "").strip() or None
        if profile.legalStandingResult is None:
            legal_standing_result_val = None
        elif isinstance(profile.legalStandingResult, str):
            legal_standing_result_val = profile.legalStandingResult
        else:
            legal_standing_result_val = json.dumps(profile.legalStandingResult)

        # Generate unique entity slug from full legal name
        base_slug = _generate_entity_slug(profile.fullLegalName)
        entity_slug = await _ensure_unique_entity_slug(conn, base_slug)

        row = await conn.fetchrow(
            """
            INSERT INTO entity (
                full_legal_name, legal_form, company_registration_number,
                headquarters_country_id, website, regions_other, sector_other,
                employee_count, annual_turnover, primary_role_id, risk_classification_id, decision_trace, legal_standing_result,
                authorized_representative_name, authorized_representative_email,
                authorized_representative_phone, ai_compliance_officer_name,
                ai_compliance_officer_email, executive_sponsor_name, executive_sponsor_email,
                slug, status
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, 'active'
            )
            RETURNING id, full_legal_name, slug, created_at
            """,
            profile.fullLegalName.strip(),
            (profile.legalForm or "").strip() or None,
            (profile.companyRegistrationNumber or "").strip() or None,
            hq_country_id,
            (profile.website or "").strip() or None,
            (profile.regionsOther or "").strip() or None,
            (profile.sectorOther or "").strip() or None,
            (profile.employeeCount or "").strip() or None,
            (profile.annualTurnover or "").strip() or None,
            primary_role_id,
            risk_classification_id,
            decision_trace_val,
            legal_standing_result_val,
            (profile.authorizedRepresentativeName or "").strip() or None,
            (profile.authorizedRepresentativeEmail or "").strip() or None,
            (profile.authorizedRepresentativePhone or "").strip() or None,
            (profile.aiComplianceOfficerName or "").strip() or None,
            (profile.aiComplianceOfficerEmail or "").strip() or None,
            (profile.executiveSponsorName or "").strip() or None,
            (profile.executiveSponsorEmail or "").strip() or None,
            entity_slug,
        )
        if not row:
            raise HTTPException(status_code=500, detail="Failed to insert entity")
        entity_id = row["id"]
        created_at = row["created_at"].isoformat() if row.get("created_at") else None

        for cid in region_ids:
            await conn.execute(
                "INSERT INTO entity_region (entity_id, country_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
                entity_id,
                cid,
            )
        for sid in sector_ids:
            await conn.execute(
                "INSERT INTO entity_sector (entity_id, sector_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
                entity_id,
                sid,
            )

    return EntityProfileResponse(
        id=str(entity_id),
        full_legal_name=row["full_legal_name"],
        created_at=created_at,
        slug=row.get("slug"),  # Include slug in response
    )


async def _entity_to_full(
    conn: asyncpg.Connection, row: asyncpg.Record, locale: Optional[str] = None
) -> EntityProfileFull:
    entity_id = row["id"]
    translation = await _get_entity_translation(conn, entity_id, locale)
    hq_name = None
    if row.get("headquarters_country_id"):
        r = await conn.fetchrow("SELECT name FROM entity_country WHERE id = $1", row["headquarters_country_id"])
        if r:
            hq_name = r["name"]
    primary_role_name = None
    if row.get("primary_role_id"):
        r = await conn.fetchrow("SELECT name FROM entity_primary_role WHERE id = $1", row["primary_role_id"])
        if r:
            primary_role_name = r["name"]
    risk_class_name = None
    if row.get("risk_classification_id"):
        r = await conn.fetchrow("SELECT name FROM entity_risk_class WHERE id = $1", row["risk_classification_id"])
        if r:
            risk_class_name = r["name"]
    regions = await conn.fetch(
        "SELECT c.name FROM entity_region er JOIN entity_country c ON c.id = er.country_id WHERE er.entity_id = $1",
        entity_id,
    )
    sectors = await conn.fetch(
        "SELECT s.name FROM entity_sector es JOIN entity_sector_lookup s ON s.id = es.sector_id WHERE es.entity_id = $1",
        entity_id,
    )

    def _pick(translated: Optional[str], base: Optional[str]) -> Optional[str]:
        return translated if translated is not None else base

    return EntityProfileFull(
        id=str(entity_id),
        slug=row.get("slug"),
        fullLegalName=_pick(translation["full_legal_name"] if translation else None, row.get("full_legal_name")) or "",
        legalForm=_pick(translation["legal_form"] if translation else None, row.get("legal_form")),
        companyRegistrationNumber=row.get("company_registration_number"),
        headquartersCountry=hq_name,
        website=row.get("website"),
        regionsOfOperation=[r["name"] for r in regions],
        regionsOther=_pick(translation["regions_other"] if translation else None, row.get("regions_other")),
        sectors=[s["name"] for s in sectors],
        sectorOther=_pick(translation["sector_other"] if translation else None, row.get("sector_other")),
        employeeCount=_pick(translation["employee_count"] if translation else None, row.get("employee_count")),
        annualTurnover=_pick(translation["annual_turnover"] if translation else None, row.get("annual_turnover")),
        primaryRole=primary_role_name,
        riskClassification=risk_class_name,
        decisionTrace=_pick(translation["decision_trace"] if translation else None, row.get("decision_trace")),
        legalStandingResult=_parse_json_field(row.get("legal_standing_result")),
        authorizedRepresentativeName=_pick(
            translation["authorized_representative_name"] if translation else None,
            row.get("authorized_representative_name"),
        ),
        authorizedRepresentativeEmail=row.get("authorized_representative_email"),
        authorizedRepresentativePhone=row.get("authorized_representative_phone"),
        aiComplianceOfficerName=_pick(
            translation["ai_compliance_officer_name"] if translation else None,
            row.get("ai_compliance_officer_name"),
        ),
        aiComplianceOfficerEmail=row.get("ai_compliance_officer_email"),
        executiveSponsorName=_pick(
            translation["executive_sponsor_name"] if translation else None,
            row.get("executive_sponsor_name"),
        ),
        executiveSponsorEmail=row.get("executive_sponsor_email"),
        createdAt=row["created_at"].isoformat() if row.get("created_at") else None,
        updatedAt=row["updated_at"].isoformat() if row.get("updated_at") else None,
    )


@router.get("/latest", response_model=EntityProfileFull)
async def get_entity_latest(locale: Optional[str] = None) -> EntityProfileFull:
    """Return the most recently created entity (for Entity Setup page when no id in URL)."""
    pool = await _get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM entity ORDER BY created_at DESC NULLS LAST LIMIT 1"
        )
        if not row:
            raise HTTPException(status_code=404, detail="No entity found")
        return await _entity_to_full(conn, row, locale)


@router.get("/by-slug/{slug}", response_model=EntityProfileFull)
async def get_entity_by_slug(slug: str, locale: Optional[str] = None) -> EntityProfileFull:
    """Return a single entity by slug."""
    pool = await _get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM entity WHERE slug = $1", slug)
        if not row:
            raise HTTPException(status_code=404, detail="Entity not found")
        return await _entity_to_full(conn, row, locale)


@router.get("/{entity_id}", response_model=EntityProfileFull)
async def get_entity(entity_id: UUID, locale: Optional[str] = None) -> EntityProfileFull:
    """Return a single entity by id."""
    pool = await _get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM entity WHERE id = $1", entity_id)
        if not row:
            raise HTTPException(status_code=404, detail="Entity not found")
        return await _entity_to_full(conn, row, locale)


@router.patch("/{entity_id}", response_model=EntityProfileFull)
async def update_entity(
    entity_id: UUID,
    body: EntityProfileUpdate,
    request: Request,
) -> EntityProfileFull:
    """Update entity (Entity Setup page). Excludes website, fullLegalName, legalForm. Auditable."""
    pool = await _get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM entity WHERE id = $1", entity_id)
        if not row:
            raise HTTPException(status_code=404, detail="Entity not found")

        # Ensure slug exists - generate if missing
        if not row.get("slug") and row.get("full_legal_name"):
            base_slug = _generate_entity_slug(row["full_legal_name"])
            entity_slug = await _ensure_unique_entity_slug(conn, base_slug)
            await conn.execute(
                "UPDATE entity SET slug = $1 WHERE id = $2",
                entity_slug,
                entity_id,
            )
            # Reload row to get updated slug
            row = await conn.fetchrow("SELECT * FROM entity WHERE id = $1", entity_id)

        updates: Dict[str, Any] = {}
        if body.headquartersCountry is not None:
            updates["headquarters_country_id"] = await _get_or_create_country(conn, body.headquartersCountry)
        if body.primaryRole is not None:
            updates["primary_role_id"] = await _get_or_create_primary_role(conn, body.primaryRole) if body.primaryRole.strip() else None
        if body.riskClassification is not None:
            updates["risk_classification_id"] = await _get_or_create_risk_class(conn, body.riskClassification) if body.riskClassification.strip() else None
        if body.decisionTrace is not None:
            updates["decision_trace"] = body.decisionTrace.strip() or None
        if body.legalStandingResult is not None:
            if isinstance(body.legalStandingResult, str):
                updates["legal_standing_result"] = body.legalStandingResult
            else:
                updates["legal_standing_result"] = json.dumps(body.legalStandingResult)
        if body.companyRegistrationNumber is not None:
            updates["company_registration_number"] = (body.companyRegistrationNumber or "").strip() or None
        if body.regionsOther is not None:
            updates["regions_other"] = (body.regionsOther or "").strip() or None
        if body.sectorOther is not None:
            updates["sector_other"] = (body.sectorOther or "").strip() or None
        if body.employeeCount is not None:
            updates["employee_count"] = (body.employeeCount or "").strip() or None
        if body.annualTurnover is not None:
            updates["annual_turnover"] = (body.annualTurnover or "").strip() or None
        if body.authorizedRepresentativeName is not None:
            updates["authorized_representative_name"] = (body.authorizedRepresentativeName or "").strip() or None
        if body.authorizedRepresentativeEmail is not None:
            updates["authorized_representative_email"] = (body.authorizedRepresentativeEmail or "").strip() or None
        if body.authorizedRepresentativePhone is not None:
            updates["authorized_representative_phone"] = (body.authorizedRepresentativePhone or "").strip() or None
        if body.aiComplianceOfficerName is not None:
            updates["ai_compliance_officer_name"] = (body.aiComplianceOfficerName or "").strip() or None
        if body.aiComplianceOfficerEmail is not None:
            updates["ai_compliance_officer_email"] = (body.aiComplianceOfficerEmail or "").strip() or None
        if body.executiveSponsorName is not None:
            updates["executive_sponsor_name"] = (body.executiveSponsorName or "").strip() or None
        if body.executiveSponsorEmail is not None:
            updates["executive_sponsor_email"] = (body.executiveSponsorEmail or "").strip() or None

        if updates:
            keys = [k for k in updates]
            set_parts = [f"{k} = ${i+2}" for i, k in enumerate(keys)]
            set_parts.append("updated_at = now()")
            params: List[Any] = [entity_id] + [updates[k] for k in keys]
            await conn.execute(
                "UPDATE entity SET " + ", ".join(set_parts) + " WHERE id = $1",
                *params,
            )

        if body.regionsOfOperation is not None:
            region_ids: List[UUID] = []
            for r in body.regionsOfOperation:
                if r and r.strip() and r.strip().lower() != "other":
                    cid = await _get_or_create_country(conn, r.strip())
                    if cid and cid not in region_ids:
                        region_ids.append(cid)
            await conn.execute("DELETE FROM entity_region WHERE entity_id = $1", entity_id)
            for cid in region_ids:
                await conn.execute(
                    "INSERT INTO entity_region (entity_id, country_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
                    entity_id,
                    cid,
                )
        if body.sectors is not None:
            sector_ids: List[UUID] = []
            for s in body.sectors:
                if s and s.strip():
                    sid = await _get_or_create_sector(conn, s.strip())
                    if sid and sid not in sector_ids:
                        sector_ids.append(sid)
            await conn.execute("DELETE FROM entity_sector WHERE entity_id = $1", entity_id)
            for sid in sector_ids:
                await conn.execute(
                    "INSERT INTO entity_sector (entity_id, sector_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
                    entity_id,
                    sid,
                )

        actor = request.headers.get("x-leadai-user") or request.headers.get("x-forwarded-user") or "anonymous"
        if append_audit_event and updates:
            await append_audit_event(
                event_type="entity.updated",
                actor=actor,
                object_type="entity",
                object_id=str(entity_id),
                details={"updated_fields": body.model_dump(exclude_none=True)},
            )

        row = await conn.fetchrow("SELECT * FROM entity WHERE id = $1", entity_id)
        return await _entity_to_full(conn, row)
