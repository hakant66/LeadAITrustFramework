"""
Control reminder workflow: send reminders at due_date - (reminder_count - n + 1) * reminder_day
for n = 1..reminder_count. When evidence is finalized for the control, advance cycle (due_date += frequency).
"""
from __future__ import annotations

import os
from datetime import date, timedelta

import asyncpg

from app.db_async import get_pool
from app.services.email_service import EmailConfigError, send_control_reminder_email


def _email_configured() -> bool:
    url = (os.environ.get("EMAIL_SERVER") or "").strip()
    return bool(url)


async def advance_cycle_for_control(
    conn: asyncpg.Connection,
    project_slug: str,
    control_id: str,
) -> bool:
    """
    Advance the control cycle: set due_date = due_date + frequency for the
    control_values_exec row. Call when evidence is finalized so reminders stop.
    Returns True if a row was updated.
    """
    entity_slug = await conn.fetchval(
        """
        SELECT e.slug
        FROM control_values v
        JOIN entity e ON e.id = v.entity_id
        WHERE v.project_slug = $1 AND v.control_id = $2::uuid
        LIMIT 1
        """,
        project_slug,
        control_id,
    )
    if not entity_slug:
        return False

    res = await conn.execute(
        """
        UPDATE control_values_exec
        SET due_date = due_date + frequency,
            updated_at = NOW()
        WHERE entity_slug = $1 AND project_slug = $2 AND control_id = $3::uuid
          AND frequency IS NOT NULL AND frequency > 0
        """,
        entity_slug,
        project_slug,
        control_id,
    )
    return res.split()[-1] != "0"


async def run_control_reminders() -> dict:
    """
    Find controls due for a reminder today and send emails. Log each send in control_reminder_log.
    Reminder n (1..reminder_count) is sent when today >= due_date - (reminder_count - n + 1) * reminder_day.
    Returns {"sent": int, "errors": int} or {"sent": 0, "errors": 0, "skipped": str} if email not configured.
    """
    if not _email_configured():
        return {"sent": 0, "errors": 0, "skipped": "EMAIL_SERVER not configured"}

    pool = await get_pool()
    today = date.today()
    sent = 0
    errors = 0

    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT e.entity_slug, e.project_slug, e.control_id::text AS control_id,
                   e.due_date, e.frequency, e.reminder_day, e.reminder_count,
                   e.designated_owner_email, e.designated_owner_name,
                   c.name AS control_name, k.name AS kpi_name
            FROM control_values_exec e
            LEFT JOIN controls c ON c.id = e.control_id
            LEFT JOIN kpis k ON k.key = c.kpi_key
            WHERE e.frequency IS NOT NULL AND e.frequency > 0
              AND e.reminder_day IS NOT NULL AND e.reminder_day > 0
              AND e.reminder_count IS NOT NULL AND e.reminder_count > 0
              AND e.due_date IS NOT NULL
              AND e.designated_owner_email IS NOT NULL
              AND e.due_date >= $1
            """,
            today,
        )

        for row in rows:
            due = row["due_date"]
            if due is None:
                continue
            freq = int(row["frequency"] or 0)
            rday = int(row["reminder_day"] or 0)
            rcount = int(row["reminder_count"] or 0)
            if freq <= 0 or rday <= 0 or rcount <= 0:
                continue

            for reminder_number in range(1, rcount + 1):
                days_before_due = (rcount - reminder_number + 1) * rday
                reminder_date = due - timedelta(days=days_before_due)
                if today < reminder_date:
                    continue

                already = await conn.fetchval(
                    """
                    SELECT 1 FROM control_reminder_log
                    WHERE entity_slug = $1 AND project_slug = $2 AND control_id = $3::uuid
                      AND due_date = $4 AND reminder_number = $5
                    LIMIT 1
                    """,
                    row["entity_slug"],
                    row["project_slug"],
                    row["control_id"],
                    due,
                    reminder_number,
                )
                if already:
                    continue

                to_email = (row["designated_owner_email"] or "").strip()
                if not to_email:
                    continue

                recipient_name = (row["designated_owner_name"] or "Owner").strip() or "Owner"
                days_until_due = (due - today).days

                try:
                    send_control_reminder_email(
                        to_email=to_email,
                        recipient_name=recipient_name,
                        kpi_name=row.get("kpi_name"),
                        control_name=row.get("control_name"),
                        due_date=str(due),
                        reminder_number=reminder_number,
                        reminder_count=rcount,
                        project_slug=row["project_slug"],
                        entity_slug=row["entity_slug"],
                        days_until_due=days_until_due,
                    )
                except EmailConfigError:
                    errors += 1
                    continue

                await conn.execute(
                    """
                    INSERT INTO control_reminder_log (entity_slug, project_slug, control_id, due_date, reminder_number)
                    VALUES ($1, $2, $3::uuid, $4, $5)
                    ON CONFLICT (entity_slug, project_slug, control_id, due_date, reminder_number) DO NOTHING
                    """,
                    row["entity_slug"],
                    row["project_slug"],
                    row["control_id"],
                    due,
                    reminder_number,
                )
                sent += 1
                break

    return {"sent": sent, "errors": errors}
