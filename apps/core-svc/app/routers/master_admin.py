# app/routers/master_admin.py
"""
Master admin API: list, update, and archive all entities.
Protected by MASTER_ADMIN_USER_IDS. Archiving copies entity to entity_archive
then deletes the entity (CASCADE removes all related records).
"""
from __future__ import annotations

import os
from uuid import UUID, uuid4

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Query
import asyncpg
from pydantic import BaseModel, Field

from app.dependencies import get_master_admin_user_id
from app.services.email_service import (
    EmailConfigError,
    _parse_smtp_url,
    get_effective_email_config,
    send_email_with_config,
)
from app.services.audit_log import append_audit_event
from app.routers.entity import (
    _get_pool,
    _entity_to_full,
    EntityProfileFull,
    EntityProfileUpdate,
)
from app.routers.entity import update_entity as entity_update_entity

router = APIRouter(prefix="/admin/master", tags=["master-admin"])


class UserEntityAccessRequest(BaseModel):
    role: str = Field(..., description="Role: admin, editor, or viewer")


class UserEntityAccessItem(BaseModel):
    entity_id: str
    entity_name: str
    entity_slug: str | None
    role: str
    granted_at: str | None


class UserWithAccess(BaseModel):
    nextauth_user_id: str
    backend_user_id: str
    email: str | None
    name: str | None
    department: str | None
    role: str | None
    status: str | None
    entities: list[UserEntityAccessItem]


class CreateUserRequest(BaseModel):
    email: str = Field(..., description="User email address")
    name: str | None = Field(default=None, description="Optional display name")


class UpdateUserProfileRequest(BaseModel):
    name: str | None = Field(default=None, description="Optional display name")
    department: str | None = Field(default=None, description="Department or team")
    role: str | None = Field(default=None, description="Job role or title")
    status: str | None = Field(
        default=None,
        description='Status: "internal", "external", or "inactive"',
    )


class CreateUserResponse(BaseModel):
    nextauth_user_id: str
    backend_user_id: str
    email: str
    name: str | None
    created: bool


class UpdateUserProfileResponse(BaseModel):
    nextauth_user_id: str
    email: str | None
    name: str | None
    department: str | None
    role: str | None
    status: str | None


class UITranslationUpsert(BaseModel):
    english_text: str = Field(..., description="English UI string (unique key)")
    locale: str = Field(..., description="Locale code, e.g., tr")
    translated_text: str = Field(..., description="Translated UI string")


class UITranslationOut(BaseModel):
    english_text: str
    locale: str
    translated_text: str
    updated_at: str | None


class EmailSettingsOut(BaseModel):
    email_from: str
    smtp_host: str
    smtp_port: int
    smtp_username: str | None = None
    use_ssl: bool
    smtp_url_masked: str
    source: str
    can_save: bool


class EmailSettingsUpsertIn(BaseModel):
    email_server: str = Field(..., description="SMTP URL, e.g. smtp://user:pass@host:587")
    email_from: str = Field(..., description="From address label")


class EmailSettingsTestIn(BaseModel):
    to_email: str = Field(..., description="Test recipient address")


def _smtp_settings_key() -> str:
    return (os.getenv("SMTP_SETTINGS_ENCRYPTION_KEY") or "").strip()


def _mask_smtp_url(url: str) -> str:
    host, port, username, _password, use_ssl = _parse_smtp_url(url)
    scheme = "smtps" if use_ssl else "smtp"
    user_part = username or "user"
    return f"{scheme}://{user_part}:***@{host}:{port}"


@router.get("/entities", response_model=list[dict])
async def list_all_entities(
    _user_id: UUID = Depends(get_master_admin_user_id),
) -> list[dict]:
    """List all entities (master admin only)."""
    pool = await _get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id, full_legal_name, slug, status, created_at, updated_at
            FROM entity
            ORDER BY full_legal_name
            """
        )
        return [
            {
                "id": str(r["id"]),
                "full_legal_name": r["full_legal_name"],
                "slug": r.get("slug"),
                "status": r.get("status"),
                "created_at": r["created_at"].isoformat() if r.get("created_at") else None,
                "updated_at": r["updated_at"].isoformat() if r.get("updated_at") else None,
            }
            for r in rows
        ]


@router.get("/entities/{entity_id}", response_model=EntityProfileFull)
async def get_entity_master(
    entity_id: UUID,
    _user_id: UUID = Depends(get_master_admin_user_id),
) -> EntityProfileFull:
    """Get a single entity by id (master admin only)."""
    pool = await _get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM entity WHERE id = $1", entity_id)
        if not row:
            raise HTTPException(status_code=404, detail="Entity not found")
        return await _entity_to_full(conn, row)


@router.patch("/entities/{entity_id}", response_model=EntityProfileFull)
async def update_entity_master(
    entity_id: UUID,
    body: EntityProfileUpdate,
    request: Request,
    _user_id: UUID = Depends(get_master_admin_user_id),
) -> EntityProfileFull:
    """Update an entity (master admin only). Delegates to entity router."""
    return await entity_update_entity(entity_id, body, request)


@router.post("/entities/{entity_id}/archive")
async def archive_entity(
    entity_id: UUID,
    request: Request,
    _user_id: UUID = Depends(get_master_admin_user_id),
) -> dict:
    """
    Archive an entity: copy row to entity_archive (with action, archived_by, archived_at),
    then delete the entity. All related records are removed by FK CASCADE.
    """
    pool = await _get_pool()
    actor = (
        request.headers.get("x-leadai-user")
        or request.headers.get("x-forwarded-user")
        or request.headers.get("X-NextAuth-User-ID")
        or str(_user_id)
    )
    async with pool.acquire() as conn:
        async with conn.transaction():
            row = await conn.fetchrow("SELECT * FROM entity WHERE id = $1", entity_id)
            if not row:
                archived = await conn.fetchval(
                    "SELECT 1 FROM entity_archive WHERE id = $1",
                    entity_id,
                )
                if archived:
                    return {
                        "ok": True,
                        "entity_id": str(entity_id),
                        "archived_by": actor,
                        "already_archived": True,
                    }
                raise HTTPException(status_code=404, detail="Entity not found")

            # Build UPSERT into entity_archive (all entity columns + action, archived_by, archived_at)
            entity_columns = [
                "id", "full_legal_name", "legal_form", "company_registration_number",
                "headquarters_country_id", "website", "regions_other", "sector_other",
                "employee_count", "annual_turnover", "primary_role_id", "risk_classification_id",
                "decision_trace", "authorized_representative_name", "authorized_representative_email",
                "authorized_representative_phone", "ai_compliance_officer_name", "ai_compliance_officer_email",
                "executive_sponsor_name", "executive_sponsor_email",
                "created_at", "updated_at", "slug", "status",
            ]
            cols = [c for c in entity_columns if c in row.keys()]
            placeholders = ", ".join(f"${i+1}" for i in range(len(cols)))
            cols_str = ", ".join(cols)
            values = [row[c] for c in cols]
            # Add action, archived_by, archived_at
            cols_str += ", action, archived_by, archived_at"
            placeholders += f", ${len(cols)+1}, ${len(cols)+2}, now()"
            values.extend(["archived", actor])

            upsert_set = ", ".join(
                [
                    f"{c} = EXCLUDED.{c}"
                    for c in cols
                    if c != "id"
                ]
                + [
                    "action = EXCLUDED.action",
                    "archived_by = EXCLUDED.archived_by",
                    "archived_at = EXCLUDED.archived_at",
                ]
            )

            await conn.execute(
                f"""
                INSERT INTO entity_archive ({cols_str})
                VALUES ({placeholders})
                ON CONFLICT (id) DO UPDATE SET
                {upsert_set}
                """,
                *values,
            )

            # Some legacy tables still reference entity without ON DELETE CASCADE.
            await conn.execute("DELETE FROM entity_policy_register_status WHERE entity_id = $1", entity_id)
            await conn.execute("DELETE FROM entity_policy_register WHERE entity_id = $1", entity_id)
            await conn.execute("DELETE FROM report_sources WHERE entity_id = $1", entity_id)

            # Delete entity (CASCADE will remove entity_region, entity_sector, entity_projects and all dependent rows)
            await conn.execute("DELETE FROM entity WHERE id = $1", entity_id)

    return {"ok": True, "entity_id": str(entity_id), "archived_by": actor}


@router.get("/users", response_model=list[UserWithAccess])
async def list_all_users_with_access(
    _user_id: UUID = Depends(get_master_admin_user_id),
) -> list[UserWithAccess]:
    """List all users with their entity access (master admin only)."""
    pool = await _get_pool()
    async with pool.acquire() as conn:
        # Get all users from auth.User
        users = await conn.fetch(
            """
            SELECT id, email, name, department, role, status
            FROM auth."User"
            ORDER BY email NULLS LAST, name NULLS LAST
            """
        )
        
        result = []
        for user_row in users:
            nextauth_user_id = user_row["id"]
            
            # Get backend_user_id from user_mapping
            mapping_row = await conn.fetchrow(
                """
                SELECT backend_user_id
                FROM user_mapping
                WHERE nextauth_user_id = $1
                """,
                nextauth_user_id,
            )
            
            backend_user_id = None
            if mapping_row:
                backend_user_id = str(mapping_row["backend_user_id"])
            
            # Get entity access for this user
            entities = []
            if backend_user_id:
                entity_rows = await conn.fetch(
                    """
                    SELECT 
                        e.id AS entity_id,
                        e.full_legal_name AS entity_name,
                        e.slug AS entity_slug,
                        uea.role,
                        uea.granted_at
                    FROM user_entity_access uea
                    JOIN entity e ON e.id = uea.entity_id
                    WHERE uea.user_id = $1::uuid
                    ORDER BY e.full_legal_name
                    """,
                    backend_user_id,
                )
                entities = [
                    UserEntityAccessItem(
                        entity_id=str(r["entity_id"]),
                        entity_name=r["entity_name"],
                        entity_slug=r.get("entity_slug"),
                        role=r["role"],
                        granted_at=r["granted_at"].isoformat() if r.get("granted_at") else None,
                    )
                    for r in entity_rows
                ]
            
            result.append(
                UserWithAccess(
                    nextauth_user_id=nextauth_user_id,
                    backend_user_id=backend_user_id or "",
                    email=user_row.get("email"),
                    name=user_row.get("name"),
                    department=user_row.get("department"),
                    role=user_row.get("role"),
                    status=user_row.get("status"),
                    entities=entities,
                )
            )
        
        return result


@router.post("/users", response_model=CreateUserResponse)
async def create_user(
    body: CreateUserRequest,
    _user_id: UUID = Depends(get_master_admin_user_id),
) -> CreateUserResponse:
    email = (body.email or "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")

    pool = await _get_pool()
    async with pool.acquire() as conn:
        user_row = await conn.fetchrow(
            """
            SELECT id, email, name
            FROM auth."User"
            WHERE email = $1
            """,
            email,
        )

        created = False
        if not user_row:
            nextauth_user_id = str(uuid4())
            await conn.execute(
                """
                INSERT INTO auth."User" (id, email, name)
                VALUES ($1, $2, $3)
                """,
                nextauth_user_id,
                email,
                body.name,
            )
            created = True
            name = body.name
        else:
            nextauth_user_id = user_row["id"]
            name = user_row.get("name")
            if body.name and not name:
                await conn.execute(
                    """
                    UPDATE auth."User"
                    SET name = $1
                    WHERE id = $2
                    """,
                    body.name,
                    nextauth_user_id,
                )
                name = body.name

        mapping_row = await conn.fetchrow(
            """
            SELECT backend_user_id
            FROM user_mapping
            WHERE nextauth_user_id = $1
            """,
            nextauth_user_id,
        )
        if not mapping_row:
            backend_user_id = uuid4()
            await conn.execute(
                """
                INSERT INTO user_mapping (nextauth_user_id, backend_user_id)
                VALUES ($1, $2)
                ON CONFLICT (nextauth_user_id) DO NOTHING
                """,
                nextauth_user_id,
                backend_user_id,
            )
        mapping_row = await conn.fetchrow(
            """
            SELECT backend_user_id
            FROM user_mapping
            WHERE nextauth_user_id = $1
            """,
            nextauth_user_id,
        )
        backend_user_id = str(mapping_row["backend_user_id"]) if mapping_row else ""

    return CreateUserResponse(
        nextauth_user_id=nextauth_user_id,
        backend_user_id=backend_user_id,
        email=email,
        name=name,
        created=created,
    )


@router.patch("/users/{user_id}", response_model=UpdateUserProfileResponse)
async def update_user_profile(
    user_id: str,
    body: UpdateUserProfileRequest,
    request: Request,
    _user_id: UUID = Depends(get_master_admin_user_id),
) -> UpdateUserProfileResponse:
    allowed_statuses = {"internal", "external", "inactive"}
    if body.status is not None and body.status not in allowed_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status: {body.status}. Must be internal, external, or inactive.",
        )

    pool = await _get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT id, email, name, department, role, status
            FROM auth."User"
            WHERE id = $1
            """,
            user_id,
        )
        if not row:
            raise HTTPException(status_code=404, detail="User not found")

        updated_name = body.name if body.name is not None else row.get("name")
        updated_department = body.department if body.department is not None else row.get("department")
        updated_role = body.role if body.role is not None else row.get("role")
        updated_status = body.status if body.status is not None else row.get("status")

        await conn.execute(
            """
            UPDATE auth."User"
            SET name = $1, department = $2, role = $3, status = $4
            WHERE id = $5
            """,
            updated_name,
            updated_department,
            updated_role,
            updated_status,
            user_id,
        )

    actor = (
        request.headers.get("x-leadai-user")
        or request.headers.get("x-forwarded-user")
        or request.headers.get("X-NextAuth-User-ID")
        or str(_user_id)
    )
    await append_audit_event(
        event_type="user_profile_update",
        actor=actor,
        actor_type="user",
        source_service="core-svc",
        object_type="user_profile",
        object_id=user_id,
        details={
            "name": updated_name,
            "department": updated_department,
            "role": updated_role,
            "status": updated_status,
        },
    )

    return UpdateUserProfileResponse(
        nextauth_user_id=user_id,
        email=row.get("email"),
        name=updated_name,
        department=updated_department,
        role=updated_role,
        status=updated_status,
    )


@router.post("/users/{user_id}/entities/{entity_id}")
async def add_user_to_entity(
    user_id: UUID,
    entity_id: UUID,
    body: UserEntityAccessRequest,
    _admin_user_id: UUID = Depends(get_master_admin_user_id),
) -> dict:
    """Add user to entity with specified role (master admin only)."""
    pool = await _get_pool()
    async with pool.acquire() as conn:
        # Validate role
        if body.role not in ["admin", "editor", "viewer"]:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid role: {body.role}. Must be admin, editor, or viewer."
            )
        
        # Check if user exists in user_mapping
        mapping_row = await conn.fetchrow(
            """
            SELECT backend_user_id
            FROM user_mapping
            WHERE backend_user_id = $1
            """,
            user_id,
        )
        if not mapping_row:
            raise HTTPException(
                status_code=404,
                detail=f"User not found: {user_id}. User must have logged in at least once."
            )
        
        # Check if entity exists
        entity_row = await conn.fetchrow(
            "SELECT id FROM entity WHERE id = $1",
            entity_id,
        )
        if not entity_row:
            raise HTTPException(status_code=404, detail="Entity not found")
        
        # Insert or update user_entity_access
        await conn.execute(
            """
            INSERT INTO user_entity_access (user_id, entity_id, role, granted_at, granted_by)
            VALUES ($1, $2, $3, NOW(), $4)
            ON CONFLICT (user_id, entity_id) DO UPDATE
            SET role = EXCLUDED.role,
                granted_at = NOW(),
                granted_by = EXCLUDED.granted_by
            """,
            user_id,
            entity_id,
            body.role,
            _admin_user_id,
        )
        
        return {
            "ok": True,
            "user_id": str(user_id),
            "entity_id": str(entity_id),
            "role": body.role,
        }


@router.patch("/users/{user_id}/entities/{entity_id}")
async def update_user_entity_role(
    user_id: UUID,
    entity_id: UUID,
    body: UserEntityAccessRequest,
    _admin_user_id: UUID = Depends(get_master_admin_user_id),
) -> dict:
    """Update user's role for an entity (master admin only)."""
    pool = await _get_pool()
    async with pool.acquire() as conn:
        # Validate role
        if body.role not in ["admin", "editor", "viewer"]:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid role: {body.role}. Must be admin, editor, or viewer."
            )
        
        # Check if access exists
        existing = await conn.fetchrow(
            """
            SELECT role
            FROM user_entity_access
            WHERE user_id = $1 AND entity_id = $2
            """,
            user_id,
            entity_id,
        )
        if not existing:
            raise HTTPException(
                status_code=404,
                detail="User does not have access to this entity. Use POST to add access."
            )
        
        # Update role
        await conn.execute(
            """
            UPDATE user_entity_access
            SET role = $1, granted_by = $2
            WHERE user_id = $3 AND entity_id = $4
            """,
            body.role,
            _admin_user_id,
            user_id,
            entity_id,
        )
        
        return {
            "ok": True,
            "user_id": str(user_id),
            "entity_id": str(entity_id),
            "role": body.role,
        }


@router.delete("/users/{user_id}/entities/{entity_id}")
async def remove_user_from_entity(
    user_id: UUID,
    entity_id: UUID,
    _user_id: UUID = Depends(get_master_admin_user_id),
) -> dict:
    """Remove user's access to an entity (master admin only)."""
    pool = await _get_pool()
    async with pool.acquire() as conn:
        # Check if access exists
        existing = await conn.fetchrow(
            """
            SELECT role
            FROM user_entity_access
            WHERE user_id = $1 AND entity_id = $2
            """,
            user_id,
            entity_id,
        )
        if not existing:
            raise HTTPException(
                status_code=404,
                detail="User does not have access to this entity."
            )
        
        # Delete access
        await conn.execute(
            """
            DELETE FROM user_entity_access
            WHERE user_id = $1 AND entity_id = $2
            """,
            user_id,
            entity_id,
        )
        
        return {
            "ok": True,
            "user_id": str(user_id),
            "entity_id": str(entity_id),
        }


@router.get("/email-settings", response_model=EmailSettingsOut)
async def get_email_settings(
    _user_id: UUID = Depends(get_master_admin_user_id),
) -> EmailSettingsOut:
    pool = await _get_pool()
    key = _smtp_settings_key()
    async with pool.acquire() as conn:
        row = None
        if key:
            try:
                row = await conn.fetchrow(
                    """
                    SELECT pgp_sym_decrypt(smtp_url_enc, $1)::text AS email_server,
                           email_from
                    FROM system_email_settings
                    WHERE singleton = true
                    LIMIT 1
                    """,
                    key,
                )
            except asyncpg.UndefinedTableError:
                row = None

    source = "env"
    try:
        effective = get_effective_email_config()
    except EmailConfigError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    email_server = effective["email_server"]
    email_from = effective["email_from"]
    if row and row.get("email_server"):
        email_server = row["email_server"]
        email_from = row["email_from"] or email_from
        source = "db"

    host, port, username, _password, use_ssl = _parse_smtp_url(email_server)
    return EmailSettingsOut(
        email_from=email_from,
        smtp_host=host,
        smtp_port=port,
        smtp_username=username,
        use_ssl=use_ssl,
        smtp_url_masked=_mask_smtp_url(email_server),
        source=source,
        can_save=bool(key),
    )


@router.put("/email-settings", response_model=EmailSettingsOut)
async def upsert_email_settings(
    body: EmailSettingsUpsertIn,
    request: Request,
    _user_id: UUID = Depends(get_master_admin_user_id),
) -> EmailSettingsOut:
    key = _smtp_settings_key()
    if not key:
        raise HTTPException(
            status_code=400,
            detail="SMTP_SETTINGS_ENCRYPTION_KEY is required on core-svc to save settings.",
        )

    email_server = body.email_server.strip()
    email_from = body.email_from.strip()
    if not email_from:
        raise HTTPException(status_code=400, detail="email_from is required")
    try:
        host, port, username, _password, use_ssl = _parse_smtp_url(email_server)
    except EmailConfigError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    pool = await _get_pool()
    async with pool.acquire() as conn:
        try:
            await conn.execute(
                """
                INSERT INTO system_email_settings (singleton, smtp_url_enc, email_from, updated_by, updated_at)
                VALUES (true, pgp_sym_encrypt($1, $2), $3, $4, now())
                ON CONFLICT (singleton)
                DO UPDATE SET
                    smtp_url_enc = pgp_sym_encrypt($1, $2),
                    email_from = EXCLUDED.email_from,
                    updated_by = EXCLUDED.updated_by,
                    updated_at = now()
                """,
                email_server,
                key,
                email_from,
                _user_id,
            )
        except asyncpg.UndefinedTableError as exc:
            raise HTTPException(
                status_code=500,
                detail="system_email_settings table is missing. Run database migrations.",
            ) from exc

    actor = (
        request.headers.get("x-leadai-user")
        or request.headers.get("x-forwarded-user")
        or request.headers.get("X-NextAuth-User-ID")
        or str(_user_id)
    )
    await append_audit_event(
        event_type="email_settings_upsert",
        actor=actor,
        actor_type="user",
        source_service="core-svc",
        object_type="system_email_settings",
        object_id="singleton",
        details={"email_from": email_from, "smtp_host": host, "smtp_port": port, "smtp_username": username},
    )

    return EmailSettingsOut(
        email_from=email_from,
        smtp_host=host,
        smtp_port=port,
        smtp_username=username,
        use_ssl=use_ssl,
        smtp_url_masked=_mask_smtp_url(email_server),
        source="db",
        can_save=True,
    )


@router.post("/email-settings/test")
async def send_test_email_settings(
    body: EmailSettingsTestIn,
    request: Request,
    _user_id: UUID = Depends(get_master_admin_user_id),
) -> dict:
    to_email = body.to_email.strip()
    if not to_email:
        raise HTTPException(status_code=400, detail="to_email is required")

    try:
        effective = get_effective_email_config()
    except EmailConfigError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        send_email_with_config(
            to_email=to_email,
            subject="LeadAI SMTP test email",
            body="This is a test email from LeadAI System Admin email settings.",
            server_url=effective["email_server"],
            from_address=effective["email_from"],
        )
    except EmailConfigError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"SMTP send failed: {exc}") from exc

    actor = (
        request.headers.get("x-leadai-user")
        or request.headers.get("x-forwarded-user")
        or request.headers.get("X-NextAuth-User-ID")
        or str(_user_id)
    )
    await append_audit_event(
        event_type="email_settings_test_send",
        actor=actor,
        actor_type="user",
        source_service="core-svc",
        object_type="system_email_settings",
        object_id="singleton",
        details={"to_email": to_email},
    )

    return {"ok": True, "sent": True, "to_email": to_email}


@router.get("/ui-translations", response_model=list[UITranslationOut])
async def list_ui_translation_overrides(
    locale: str | None = Query(default=None),
    _user_id: UUID = Depends(get_master_admin_user_id),
) -> list[UITranslationOut]:
    pool = await _get_pool()
    try:
        async with pool.acquire() as conn:
            if locale:
                rows = await conn.fetch(
                    """
                    SELECT english_text, locale, translated_text, updated_at
                    FROM ui_translation_overrides
                    WHERE locale = $1
                    ORDER BY english_text ASC
                    """,
                    locale,
                )
            else:
                rows = await conn.fetch(
                    """
                    SELECT english_text, locale, translated_text, updated_at
                    FROM ui_translation_overrides
                    ORDER BY locale ASC, english_text ASC
                    """
                )
    except asyncpg.UndefinedTableError:
        return []

    return [
        UITranslationOut(
            english_text=r["english_text"],
            locale=r["locale"],
            translated_text=r["translated_text"],
            updated_at=r["updated_at"].isoformat() if r.get("updated_at") else None,
        )
        for r in rows
    ]


@router.put("/ui-translations", response_model=UITranslationOut)
async def upsert_ui_translation_override(
    body: UITranslationUpsert,
    request: Request,
    _user_id: UUID = Depends(get_master_admin_user_id),
) -> UITranslationOut:
    if not body.english_text.strip():
        raise HTTPException(status_code=400, detail="english_text is required")
    if not body.locale.strip():
        raise HTTPException(status_code=400, detail="locale is required")
    if body.translated_text is None:
        raise HTTPException(status_code=400, detail="translated_text is required")

    pool = await _get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO ui_translation_overrides (english_text, locale, translated_text)
            VALUES ($1, $2, $3)
            ON CONFLICT (english_text, locale)
            DO UPDATE SET translated_text = EXCLUDED.translated_text, updated_at = now()
            RETURNING english_text, locale, translated_text, updated_at
            """,
            body.english_text.strip(),
            body.locale.strip(),
            body.translated_text,
        )

    actor = (
        request.headers.get("x-leadai-user")
        or request.headers.get("x-forwarded-user")
        or request.headers.get("X-NextAuth-User-ID")
        or str(_user_id)
    )
    await append_audit_event(
        event_type="ui_translation_upsert",
        actor=actor,
        actor_type="user",
        source_service="core-svc",
        object_type="ui_translation",
        object_id=f"{row['locale']}:{row['english_text']}",
        details={"translated_text": row["translated_text"]},
    )

    return UITranslationOut(
        english_text=row["english_text"],
        locale=row["locale"],
        translated_text=row["translated_text"],
        updated_at=row["updated_at"].isoformat() if row.get("updated_at") else None,
    )


@router.delete("/ui-translations", status_code=204)
async def delete_ui_translation_override(
    request: Request,
    english_text: str = Query(...),
    locale: str = Query(...),
    _user_id: UUID = Depends(get_master_admin_user_id),
) -> None:
    if not english_text.strip() or not locale.strip():
        raise HTTPException(status_code=400, detail="english_text and locale are required")

    pool = await _get_pool()
    async with pool.acquire() as conn:
        result = await conn.execute(
            """
            DELETE FROM ui_translation_overrides
            WHERE english_text = $1 AND locale = $2
            """,
            english_text.strip(),
            locale.strip(),
        )

    actor = (
        request.headers.get("x-leadai-user")
        or request.headers.get("x-forwarded-user")
        or request.headers.get("X-NextAuth-User-ID")
        or str(_user_id)
    )
    await append_audit_event(
        event_type="ui_translation_delete",
        actor=actor,
        actor_type="user",
        source_service="core-svc",
        object_type="ui_translation",
        object_id=f"{locale.strip()}:{english_text.strip()}",
    )

    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Translation override not found")

    return None
