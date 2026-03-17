from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Optional

from app.db_async import get_pool

REPORT_TYPES = [
    "ai_summary_llm",
    "governance_requirements_report",
    "board_level_report",
    "board_level_deck",
]


def _default_enabled() -> bool:
    mode = os.getenv("LLM_REPORT_BATCH_SCHEDULER", "on").lower()
    return mode not in ("0", "false", "off", "no")


def _default_hour() -> int:
    hour_raw = os.getenv("LLM_REPORT_BATCH_DAILY_HOUR", "3")
    try:
        return max(0, min(23, int(hour_raw)))
    except ValueError:
        return 3


def _default_schedule(report_type: str) -> dict:
    return {
        "report_type": report_type,
        "enabled": _default_enabled(),
        "run_hour_utc": _default_hour(),
        "updated_at": None,
        "is_default": True,
    }


async def list_report_schedules() -> list[dict]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        try:
            rows = await conn.fetch(
                """
                SELECT report_type, enabled, run_hour_utc, updated_at
                FROM llm_report_schedule
                ORDER BY report_type
                """
            )
        except Exception:
            rows = []

    schedules = {row["report_type"]: dict(row) for row in rows}
    results: list[dict] = []
    for report_type in REPORT_TYPES:
        if report_type in schedules:
            payload = schedules[report_type]
            payload["is_default"] = False
            results.append(payload)
        else:
            results.append(_default_schedule(report_type))
    return results


async def get_report_schedule(report_type: str) -> dict:
    pool = await get_pool()
    async with pool.acquire() as conn:
        try:
            row = await conn.fetchrow(
                """
                SELECT report_type, enabled, run_hour_utc, updated_at
                FROM llm_report_schedule
                WHERE report_type = $1
                """,
                report_type,
            )
        except Exception:
            row = None

    if row:
        payload = dict(row)
        payload["is_default"] = False
        return payload
    return _default_schedule(report_type)


async def upsert_report_schedule(
    report_type: str,
    *,
    enabled: bool,
    run_hour_utc: int,
) -> dict:
    run_hour_utc = max(0, min(23, int(run_hour_utc)))
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO llm_report_schedule (
                report_type, enabled, run_hour_utc, updated_at
            )
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (report_type)
            DO UPDATE SET
                enabled = EXCLUDED.enabled,
                run_hour_utc = EXCLUDED.run_hour_utc,
                updated_at = EXCLUDED.updated_at
            """,
            report_type,
            enabled,
            run_hour_utc,
            datetime.now(timezone.utc),
        )
    return await get_report_schedule(report_type)
