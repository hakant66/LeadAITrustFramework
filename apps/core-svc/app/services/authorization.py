"""
Authorization service for multi-entity access control.

Validates user access to entities based on user_entity_access table.
Master admins (defined by MASTER_ADMIN_USER_IDS) can access any entity.
"""
from __future__ import annotations

from typing import Optional, List, Dict
from uuid import UUID
import os

import asyncpg
from fastapi import HTTPException

from app.db_async import get_pool


def _is_master_admin(user_id: UUID) -> bool:
    """
    Check if a user is a master admin.
    Master admins are defined by env MASTER_ADMIN_USER_IDS (comma-separated UUIDs).
    """
    raw = os.environ.get("MASTER_ADMIN_USER_IDS", "").strip()
    if not raw:
        return False
    try:
        allowed = [UUID(x.strip()) for x in raw.split(",") if x.strip()]
        return user_id in allowed
    except (ValueError, TypeError):
        return False


async def verify_entity_access(
    user_id: UUID,
    entity_id: UUID,
    required_role: Optional[str] = None,
    conn: Optional[asyncpg.Connection] = None,
) -> bool:
    """
    Verify that a user has access to an entity.
    
    Master admins (defined by MASTER_ADMIN_USER_IDS) can access any entity
    without needing an entry in user_entity_access.
    
    Args:
        user_id: The user's UUID
        entity_id: The entity UUID to check access for
        required_role: Optional minimum role required (admin > editor > viewer)
                     If None, any role grants access
                     For master admins, this check is bypassed (they always have admin-level access)
        conn: Optional database connection (creates new if not provided)
    
    Returns:
        True if user has access (and required role if specified), False otherwise
    
    Raises:
        HTTPException(403) if access denied
    """
    # Master admins can access any entity
    if _is_master_admin(user_id):
        return True
    
    if conn:
        row = await conn.fetchrow(
            """
            SELECT role
            FROM user_entity_access
            WHERE user_id = $1 AND entity_id = $2
            """,
            user_id,
            entity_id,
        )
    else:
        pool = await get_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT role
                FROM user_entity_access
                WHERE user_id = $1 AND entity_id = $2
                """,
                user_id,
                entity_id,
            )
    
    if not row:
        raise HTTPException(
            status_code=403,
            detail=f"User does not have access to entity {entity_id}"
        )
    
    user_role = row["role"]
    
    # If no specific role required, any access is sufficient
    if required_role is None:
        return True
    
    # Role hierarchy: admin > editor > viewer
    role_hierarchy = {"admin": 3, "editor": 2, "viewer": 1}
    user_role_level = role_hierarchy.get(user_role.lower(), 0)
    required_role_level = role_hierarchy.get(required_role.lower(), 0)
    
    if user_role_level < required_role_level:
        raise HTTPException(
            status_code=403,
            detail=f"User role '{user_role}' does not meet required role '{required_role}' for entity {entity_id}"
        )
    
    return True


async def get_user_entity_role(
    user_id: UUID,
    entity_id: UUID,
    conn: Optional[asyncpg.Connection] = None,
) -> Optional[str]:
    """
    Get the user's role for a specific entity.
    
    Args:
        user_id: The user's UUID
        entity_id: The entity UUID
        conn: Optional database connection
    
    Returns:
        Role string (admin, editor, viewer) or None if no access
    """
    if conn:
        row = await conn.fetchrow(
            """
            SELECT role
            FROM user_entity_access
            WHERE user_id = $1 AND entity_id = $2
            """,
            user_id,
            entity_id,
        )
    else:
        pool = await get_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT role
                FROM user_entity_access
                WHERE user_id = $1 AND entity_id = $2
                """,
                user_id,
                entity_id,
            )
    
    return row["role"] if row else None


async def get_user_entities(
    user_id: UUID,
    conn: Optional[asyncpg.Connection] = None,
) -> List[Dict[str, any]]:
    """
    Get all entities a user has access to.
    
    Args:
        user_id: The user's UUID
        conn: Optional database connection
    
    Returns:
        List of dicts with entity_id and role
    """
    if conn:
        rows = await conn.fetch(
            """
            SELECT uea.entity_id, uea.role, e.full_legal_name AS name, e.slug, e.status
            FROM user_entity_access uea
            JOIN entity e ON e.id = uea.entity_id
            WHERE uea.user_id = $1
            ORDER BY e.full_legal_name
            """,
            user_id,
        )
    else:
        pool = await get_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT uea.entity_id, uea.role, e.full_legal_name AS name, e.slug, e.status
                FROM user_entity_access uea
                JOIN entity e ON e.id = uea.entity_id
                WHERE uea.user_id = $1
                ORDER BY e.full_legal_name
                """,
                user_id,
            )
    
    return [
        {
            "entity_id": str(row["entity_id"]),
            "role": row["role"],
            "name": row["name"],
            "slug": row["slug"],
            "status": row["status"],
        }
        for row in rows
    ]


async def can_user_access_entity(
    user_id: UUID,
    entity_id: UUID,
    conn: Optional[asyncpg.Connection] = None,
) -> bool:
    """
    Check if user has access to entity (non-raising version).
    
    Returns:
        True if user has access, False otherwise
    """
    try:
        await verify_entity_access(user_id, entity_id, conn=conn)
        return True
    except HTTPException:
        return False
