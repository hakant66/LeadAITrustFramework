"""
User mapping service to convert NextAuth user IDs (cuid) to backend UUIDs.

This service maintains a mapping between NextAuth user IDs (stored in auth.User table)
and backend user UUIDs (used in user_entity_access table).
"""
from __future__ import annotations

from typing import Optional
from uuid import UUID, uuid4

import asyncpg
from fastapi import HTTPException

from app.db_async import get_pool


async def get_or_create_user_uuid(
    nextauth_user_id: str,
    conn: Optional[asyncpg.Connection] = None,
) -> UUID:
    """
    Get or create a UUID mapping for a NextAuth user ID.
    
    Args:
        nextauth_user_id: The NextAuth user ID (cuid string from auth.User table)
        conn: Optional database connection
    
    Returns:
        UUID for the user (from user_mapping table or newly created)
    
    Raises:
        HTTPException(500) if database error occurs
    """
    if conn:
        # Check if mapping exists
        row = await conn.fetchrow(
            """
            SELECT backend_user_id
            FROM user_mapping
            WHERE nextauth_user_id = $1
            """,
            nextauth_user_id,
        )
        
        if row:
            return row["backend_user_id"]
        
        # Create new mapping
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
        
        # Re-fetch in case of race condition
        row = await conn.fetchrow(
            """
            SELECT backend_user_id
            FROM user_mapping
            WHERE nextauth_user_id = $1
            """,
            nextauth_user_id,
        )
        
        if not row:
            raise HTTPException(
                status_code=500,
                detail="Failed to create user mapping"
            )
        
        return row["backend_user_id"]
    else:
        pool = await get_pool()
        async with pool.acquire() as conn:
            return await get_or_create_user_uuid(nextauth_user_id, conn)


async def get_nextauth_user_id(
    backend_user_id: UUID,
    conn: Optional[asyncpg.Connection] = None,
) -> Optional[str]:
    """
    Get NextAuth user ID from backend UUID.
    
    Args:
        backend_user_id: The backend user UUID
        conn: Optional database connection
    
    Returns:
        NextAuth user ID (cuid) or None if not found
    """
    if conn:
        row = await conn.fetchrow(
            """
            SELECT nextauth_user_id
            FROM user_mapping
            WHERE backend_user_id = $1
            """,
            backend_user_id,
        )
        return row["nextauth_user_id"] if row else None
    else:
        pool = await get_pool()
        async with pool.acquire() as conn:
            return await get_nextauth_user_id(backend_user_id, conn)
