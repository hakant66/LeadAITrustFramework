"""
Current user context API: entities the authenticated user can access.

Used by the frontend to show "which entity we are working in" on global scorecard
routes (e.g. governance dashboard) that use the user's first entity when entity_id
is not in the URL.
"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.dependencies import get_current_user_id
from app.services.authorization import get_user_entities

router = APIRouter(prefix="/user", tags=["user"])


class UserEntityItem(BaseModel):
    entity_id: str = Field(..., description="Entity UUID")
    role: str = Field(..., description="User role for this entity")
    name: str = Field(..., description="Entity display name (full_legal_name)")
    slug: str = Field(..., description="Entity URL slug")
    status: str | None = Field(None, description="Entity status")


@router.get("/entities", response_model=list[UserEntityItem])
async def list_my_entities(
    user_id=Depends(get_current_user_id),
):
    """
    Return the list of entities the current user has access to.

    The first item is the same entity used as default when entity_id is not
    provided (e.g. on /scorecard/admin/governance-dashboard-reporting).
    Frontend can show "Viewing: {first_entity.name}" to make context clear.
    """
    entities = await get_user_entities(user_id)
    return [UserEntityItem(**e) for e in entities]


@router.get("/is-master-admin", response_model=bool)
async def check_is_master_admin(
    user_id=Depends(get_current_user_id),
):
    """
    Check if the current user is a master admin.
    Master admins can access any entity even without user_entity_access entries.
    """
    import os
    raw = os.environ.get("MASTER_ADMIN_USER_IDS", "").strip()
    if not raw:
        return False
    try:
        allowed = [UUID(x.strip()) for x in raw.split(",") if x.strip()]
        return user_id in allowed
    except (ValueError, TypeError):
        return False
