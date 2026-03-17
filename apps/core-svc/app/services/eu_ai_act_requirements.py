from __future__ import annotations

import json
from pathlib import Path

from app.db_async import get_pool

DATA_PATH = (
    Path(__file__).resolve().parent.parent / "seed_data" / "eu_ai_act_requirements.json"
)
COVERAGE_DEFAULT = "all-obligations"


async def ensure_eu_ai_act_requirements() -> int:
    pool = await get_pool()
    async with pool.acquire() as conn:
        table = await conn.fetchval(
            "SELECT to_regclass('public.euaiact_requirements')"
        )
        if not table:
            return 0

        count = await conn.fetchval("SELECT COUNT(*) FROM euaiact_requirements")
        if count and int(count) > 0:
            return 0

        if not DATA_PATH.exists():
            return 0

        records = json.loads(DATA_PATH.read_text(encoding="utf-8"))
        has_coverage = await conn.fetchval(
            """
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'euaiact_requirements'
              AND column_name = 'coverage'
            """
        )
        inserted = 0
        for row in records:
            if has_coverage:
                await conn.execute(
                    """
                    INSERT INTO euaiact_requirements (
                      chapter, section, article, content, links, coverage
                    )
                    VALUES ($1,$2,$3,$4,$5,$6)
                    ON CONFLICT (article, coverage) DO NOTHING
                    """,
                    row.get("chapter"),
                    row.get("section"),
                    row.get("article"),
                    row.get("content"),
                    row.get("links"),
                    row.get("coverage") or COVERAGE_DEFAULT,
                )
            else:
                await conn.execute(
                    """
                    INSERT INTO euaiact_requirements (chapter, section, article, content, links)
                    VALUES ($1,$2,$3,$4,$5)
                    ON CONFLICT (article) DO NOTHING
                    """,
                    row.get("chapter"),
                    row.get("section"),
                    row.get("article"),
                    row.get("content"),
                    row.get("links"),
                )
            inserted += 1

    return inserted
