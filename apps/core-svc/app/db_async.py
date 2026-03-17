"""
Async database connection pool for asyncpg.

This module provides the get_pool() function for async database operations.
Separated from scorecard.py to avoid circular import issues.
"""
from __future__ import annotations

import os
from typing import Optional

import asyncpg
from fastapi import HTTPException

# Use env when available; fall back to PG* settings for local/dev.
DATABASE_URL = (
    os.getenv("DATABASE_URL")
    or os.getenv("SQLALCHEMY_DATABASE_URI")
    or os.getenv("DATABASE_URL", "postgresql://leadai:leadai@localhost:5432/leadai")
)

_pool: Optional[asyncpg.Pool] = None


async def get_pool() -> asyncpg.Pool:
    """Create/reuse a global asyncpg pool. Strips +driver suffixes if present."""
    global _pool
    if _pool is None:
        dsn = DATABASE_URL.replace("+asyncpg", "").replace("+psycopg", "")
        try:
            _pool = await asyncpg.create_pool(dsn=dsn, min_size=1, max_size=10)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"DB connection failed: {e}")
    return _pool
