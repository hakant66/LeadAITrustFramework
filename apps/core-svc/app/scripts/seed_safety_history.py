#!/usr/bin/env python3
"""
Seed fictive Safety pillar scores (30--70%) for the last 4 weeks for all projects.

Inserts rows into control_values_history so the trend-alerts worker (and diagnostic)
see a pillar:safety value for the latest week bucket per project.

Run from repo root with core-svc env (e.g. in Docker):
  docker exec -it core-svc python -m app.scripts.seed_safety_history
Or locally with DATABASE_URL set:
  cd apps/core-svc && python -m app.scripts.seed_safety_history

Options:
  --dry-run   Print what would be inserted without writing.
  --min, --max  Override score range (default 30--70).
"""
from __future__ import annotations

import argparse
import asyncio
import random
from datetime import datetime, timezone, timedelta
from uuid import uuid4

from app.db_async import get_pool


def parse_args():
    p = argparse.ArgumentParser(description="Seed fictive Safety scores for last 4 weeks for all projects")
    p.add_argument("--dry-run", action="store_true", help="Do not insert; only print counts")
    p.add_argument("--min", type=float, default=30.0, help="Min normalized_pct (default 30)")
    p.add_argument("--max", type=float, default=70.0, help="Max normalized_pct (default 70)")
    return p.parse_args()


async def main() -> None:
    args = parse_args()
    pool = await get_pool()

    # 1) All (entity_id, entity_slug, project_slug), non-archived
    async with pool.acquire() as conn:
        projects = await conn.fetch(
            """
            SELECT ep.entity_id, ep.slug AS project_slug, e.slug AS entity_slug
            FROM entity_projects ep
            JOIN entity e ON e.id = ep.entity_id
            WHERE (ep.is_archived IS NOT TRUE OR ep.is_archived IS NULL)
            ORDER BY ep.entity_id, ep.slug
            """
        )
    if not projects:
        print("No projects found.")
        return

    # 2) One Safety-pillar control (control_id, kpi_key)
    async with pool.acquire() as conn:
        safety_controls = await conn.fetch(
            """
            SELECT c.id AS control_id, c.kpi_key
            FROM controls c
            LEFT JOIN pillars p ON lower(trim(p.name)) = lower(trim(c.pillar))
               OR lower(p.key) = lower(trim(c.pillar))
            WHERE (lower(p.key) = 'safety' OR lower(trim(c.pillar)) = 'safety')
            LIMIT 5
            """
        )
    if not safety_controls:
        print("No Safety-pillar controls found. Ensure controls exist with pillar 'Safety' (or pillars.key = 'safety').")
        return

    control_id = safety_controls[0]["control_id"]
    kpi_key = safety_controls[0]["kpi_key"]
    print(f"Using Safety control: id={control_id}, kpi_key={kpi_key}")

    now = datetime.now(timezone.utc)
    inserted = 0

    for proj in projects:
        entity_id = proj["entity_id"]
        entity_slug = proj["entity_slug"] or ""
        project_slug = proj["project_slug"]

        for week_offset in range(4):
            # Week bucket: week_start at midnight UTC
            week_start = now - timedelta(weeks=week_offset)
            week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
            # Midweek timestamp so date_trunc('week', observed_at) = week_start
            mid_week = week_start + timedelta(days=3, hours=12)
            pct = round(random.uniform(args.min, args.max), 2)
            raw_val = pct  # simple 0-100 scale

            if args.dry_run:
                inserted += 1
                continue

            audit_id = uuid4()
            async with pool.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO control_values_history (
                        project_slug, kpi_key, raw_value, normalized_pct, observed_at, updated_at,
                        control_id, audit_id, audit_action, audit_ts, audit_txid,
                        entity_id, entity_slug
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'INSERT', $9, 0, $10, $11)
                    """,
                    project_slug,
                    kpi_key,
                    raw_val,
                    pct,
                    mid_week,
                    mid_week,
                    control_id,
                    audit_id,
                    now,
                    entity_id,
                    entity_slug,
                )
            inserted += 1

    print(f"Done. Rows inserted: {inserted} (projects={len(projects)}, 4 weeks each).")
    if args.dry_run:
        print("(Dry run: no rows written.)")


if __name__ == "__main__":
    asyncio.run(main())
