from __future__ import annotations

from fastapi import APIRouter, Query
import asyncpg
from pydantic import BaseModel

from app.db_async import get_pool

router = APIRouter(prefix="/ui-translations", tags=["ui-translations"])


class UITranslationOut(BaseModel):
    english_text: str
    locale: str
    translated_text: str
    updated_at: str | None


@router.get("", response_model=list[UITranslationOut])
async def list_ui_translations(locale: str | None = Query(default=None)) -> list[UITranslationOut]:
    pool = await get_pool()
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
