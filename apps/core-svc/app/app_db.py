# apps/coresvc/app/app_db.py
import os
import asyncio
import asyncpg
from typing import Optional

_DB_URL = os.getenv("DATABASE_URL", "postgresql://leadai:leadai@localhost:5432/leadai")
_pool: Optional[asyncpg.Pool] = None

def get_pool() -> Optional[asyncpg.Pool]:
    """Return the global pool (may be None until init_pool() runs)."""
    return _pool

async def init_pool() -> asyncpg.Pool:
    """Create the global asyncpg pool once (idempotent)."""
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(_DB_URL, min_size=1, max_size=5)
    return _pool

async def get_project_id_by_slug(slug: str) -> Optional[str]:
    pool = get_pool() or await init_pool()
    row = await pool.fetchrow("SELECT id FROM public.projects WHERE slug=$1", slug)
    return row["id"] if row else None
