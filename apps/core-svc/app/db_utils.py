from __future__ import annotations

from typing import Optional


def normalize_pg_dsn(url: Optional[str]) -> str:
    """
    Strip SQLAlchemy driver suffixes so psycopg/asyncpg can parse the DSN.
    Example: postgresql+psycopg:// -> postgresql://
    """
    if not url:
        return ""
    for suffix in ("+psycopg", "+psycopg2", "+asyncpg"):
        url = url.replace(suffix, "")
    return url
