"""
FastAPI dependencies for entity context extraction and authorization.

Supports multiple methods for extracting entity_id:
1. URL path parameter: /entities/{entityId}/... (required when in path)
2. Query parameter: ?entity_id={uuid} (optional fallback)
3. Header: X-Entity-ID: {uuid} (optional fallback)

For routes with entityId in path, use get_entity_id_from_path.
For routes without entityId in path, use get_entity_id_optional (from query/header).

Authorization:
- get_entity_id_with_auth: Validates user has access to entity
- get_current_user_id: Extracts user_id from request (TODO: integrate with auth system)
"""
from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import HTTPException, Query, Header, Depends, Request

from app.services.authorization import verify_entity_access, get_user_entities


async def get_entity_id_from_path(entityId: str) -> UUID:
    """
    Extract entity_id from URL path parameter.
    Use this for routes like /entities/{entityId}/projects/...
    """
    try:
        return UUID(entityId)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid entity ID format: {entityId}. Must be a valid UUID."
        )


async def get_entity_id_optional(
    entity_id_query: Optional[str] = Query(default=None, alias="entity_id", description="Entity ID from query parameter"),
    entity_id_header: Optional[str] = Header(default=None, alias="X-Entity-ID", description="Entity ID from header"),
) -> Optional[UUID]:
    """
    Extract entity_id from request context (optional).
    Checks query parameter and header (not path).
    
    Returns None if not provided, UUID if valid, raises HTTPException if invalid format.
    Use this for routes that don't have entityId in the URL path.
    """
    entity_id_str = entity_id_query or entity_id_header
    
    if not entity_id_str:
        return None
    
    try:
        return UUID(entity_id_str)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid entity ID format: {entity_id_str}. Must be a valid UUID."
        )


async def get_entity_id(
    entity_id_query: Optional[str] = Query(default=None, alias="entity_id", description="Entity ID from query parameter"),
    entity_id_header: Optional[str] = Header(default=None, alias="X-Entity-ID", description="Entity ID from header"),
) -> UUID:
    """
    Extract entity_id from request context (required).
    Checks query parameter and header (not path).
    
    Raises HTTPException if entity_id is not provided or invalid.
    Use this for routes that don't have entityId in the URL path but require entity_id.
    """
    entity_id_str = entity_id_query or entity_id_header
    
    if not entity_id_str:
        raise HTTPException(
            status_code=400,
            detail="Entity ID is required. Provide it via query parameter (?entity_id=...) "
                   "or header (X-Entity-ID: ...)"
        )
    
    try:
        return UUID(entity_id_str)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid entity ID format: {entity_id_str}. Must be a valid UUID."
        )


async def get_current_user_id(request: Request) -> UUID:
    """
    Extract user_id from request context.
    
    Supports multiple methods (in order of priority):
    1. Header: X-NextAuth-User-ID: {cuid} - NextAuth user ID (mapped to UUID)
    2. Header: X-User-ID: {uuid} - Direct UUID (for testing/dev)
    3. Query parameter: ?user_id={uuid} - Direct UUID (for testing/dev)
    
    The NextAuth user ID is mapped to a backend UUID via user_mapping table.
    """
    from app.services.user_mapping import get_or_create_user_uuid
    
    # Priority 1: NextAuth user ID (from proxy)
    nextauth_user_id = request.headers.get("X-NextAuth-User-ID")
    if nextauth_user_id:
        try:
            # Map NextAuth cuid to backend UUID
            return await get_or_create_user_uuid(nextauth_user_id)
        except Exception as e:
            raise HTTPException(
                status_code=401,
                detail=f"Failed to authenticate user: {str(e)}"
            )
    
    # Priority 2: Direct UUID header (for testing/dev)
    user_id_str = request.headers.get("X-User-ID")
    
    # Priority 3: Query parameter (for testing/dev)
    if not user_id_str:
        user_id_str = request.query_params.get("user_id")
    
    if not user_id_str:
        # Optional test bypass (dev-only). Enable with:
        # TEST_BYPASS_ENABLED=1 and TEST_BYPASS_USER_ID=<uuid>
        import os
        if os.getenv("TEST_BYPASS_ENABLED") == "1":
            bypass_id = os.getenv("TEST_BYPASS_USER_ID", "").strip()
            if bypass_id:
                try:
                    return UUID(bypass_id)
                except ValueError:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            "Invalid TEST_BYPASS_USER_ID format. "
                            "Must be a valid UUID."
                        ),
                    )
        raise HTTPException(
            status_code=401,
            detail="Authentication required. Please sign in."
        )
    
    try:
        return UUID(user_id_str)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid user ID format: {user_id_str}. Must be a valid UUID."
        )


async def get_entity_id_with_auth(
    entity_id: UUID = Depends(get_entity_id_optional),
    user_id: UUID = Depends(get_current_user_id),
    required_role: Optional[str] = None,
) -> UUID:
    """
    Extract entity_id and validate user has access to it.
    
    Args:
        entity_id: Entity ID from query/header (via get_entity_id_optional)
        user_id: User ID from request (via get_current_user_id)
        required_role: Optional minimum role (admin, editor, viewer)
    
    Returns:
        Validated entity_id
    
    Raises:
        HTTPException(403) if user doesn't have access or required role
        HTTPException(400) if entity_id not provided
    """
    if entity_id is None:
        raise HTTPException(
            status_code=400,
            detail="Entity ID is required for this operation"
        )
    
    # Verify user has access to entity
    await verify_entity_access(user_id, entity_id, required_role=required_role)
    
    return entity_id


async def get_entity_id_from_path_with_auth(
    entityId: str,
    user_id: UUID = Depends(get_current_user_id),
    required_role: Optional[str] = None,
) -> UUID:
    """
    Extract entity_id from path and validate user has access to it.
    
    Args:
        entityId: Entity ID from URL path
        user_id: User ID from request
        required_role: Optional minimum role (admin, editor, viewer)
    
    Returns:
        Validated entity_id
    
    Raises:
        HTTPException(403) if user doesn't have access or required role
        HTTPException(400) if entity_id format is invalid
    """
    try:
        entity_id = UUID(entityId)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid entity ID format: {entityId}. Must be a valid UUID."
        )
    
    # Verify user has access to entity
    await verify_entity_access(user_id, entity_id, required_role=required_role)
    
    return entity_id


# Convenience wrappers for common role requirements
async def get_entity_id_with_auth_viewer(
    entity_id: Optional[UUID] = Depends(get_entity_id_optional),
    user_id: UUID = Depends(get_current_user_id),
) -> UUID:
    """Get entity_id with viewer role requirement."""
    if entity_id is None:
        raise HTTPException(
            status_code=400,
            detail="Entity ID is required for this operation"
        )
    await verify_entity_access(user_id, entity_id, required_role="viewer")
    return entity_id


async def get_entity_id_or_first_for_viewer(
    entity_id: Optional[UUID] = Depends(get_entity_id_optional),
    user_id: UUID = Depends(get_current_user_id),
) -> UUID:
    """
    Return entity_id from request, or the user's first entity from user_entity_access.
    Use for endpoints like GET /projects where entity context may not be in the request.
    """
    if entity_id is not None:
        await verify_entity_access(user_id, entity_id, required_role="viewer")
        return entity_id
    entities = await get_user_entities(user_id)
    if not entities:
        raise HTTPException(
            status_code=403,
            detail="No entity access. You need to be granted access to an entity."
        )
    return UUID(str(entities[0]["entity_id"]))


async def get_entity_id_with_auth_editor(
    entity_id: Optional[UUID] = Depends(get_entity_id_optional),
    user_id: UUID = Depends(get_current_user_id),
) -> UUID:
    """Get entity_id with editor role requirement."""
    if entity_id is None:
        raise HTTPException(
            status_code=400,
            detail="Entity ID is required for this operation"
        )
    await verify_entity_access(user_id, entity_id, required_role="editor")
    return entity_id


async def get_entity_id_with_auth_admin(
    entity_id: Optional[UUID] = Depends(get_entity_id_optional),
    user_id: UUID = Depends(get_current_user_id),
) -> UUID:
    """Get entity_id with admin role requirement."""
    if entity_id is None:
        raise HTTPException(
            status_code=400,
            detail="Entity ID is required for this operation"
        )
    await verify_entity_access(user_id, entity_id, required_role="admin")
    return entity_id


async def get_master_admin_user_id(
    user_id: UUID = Depends(get_current_user_id),
) -> UUID:
    """
    Require that the current user is a master admin.
    Master admins are defined by env MASTER_ADMIN_USER_IDS (comma-separated UUIDs).
    Used for master admin page: list/update/archive all entities.
    """
    import os
    raw = os.environ.get("MASTER_ADMIN_USER_IDS", "").strip()
    if not raw:
        raise HTTPException(
            status_code=403,
            detail="Master admin access is not configured (MASTER_ADMIN_USER_IDS)."
        )
    allowed = [UUID(x.strip()) for x in raw.split(",") if x.strip()]
    if user_id not in allowed:
        raise HTTPException(
            status_code=403,
            detail="Master admin access required."
        )
    return user_id
