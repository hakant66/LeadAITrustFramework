from __future__ import annotations

from uuid import uuid4

from app.db_async import get_pool

DEFAULT_POLICY_TITLES = [
    "AI Documentation and Traceability Policy",
    "AI Ethical Use Charter",
    "AI Governance Policy",
    "AI Regulatory Compliance Policy",
    "AI Transparency and User Notice Policy",
    "AI Workforce Training and Literacy Policy",
    "HR Hiring and Screening AI Policy",
    "Model Approval and Release Policy",
    "Responsible AI Principles",
    "Shadow AI Detection and Reporting Policy",
]

DEFAULT_POLICY_OWNER = "CAIO"
DEFAULT_POLICY_STATUS = "draft"
DEFAULT_POLICY_VERSION = "v1"


def _policy_content(title: str) -> str:
    return (
        f"{title}\n\n"
        "This default policy template outlines governance intent and minimum controls. "
        "Update the content to reflect your organization’s operating model, approvals, "
        "and compliance obligations."
    )


async def ensure_default_policies() -> int:
    pool = await get_pool()
    async with pool.acquire() as conn:
        policies_table = await conn.fetchval("SELECT to_regclass('public.policies')")
        versions_table = await conn.fetchval(
            "SELECT to_regclass('public.policy_versions')"
        )
        if not policies_table or not versions_table:
            return 0

        targets = [title.lower() for title in DEFAULT_POLICY_TITLES]
        rows = await conn.fetch(
            "SELECT title FROM policies WHERE lower(title) = ANY($1::text[])",
            targets,
        )
        existing = {row["title"].lower() for row in rows}
        inserted = 0

        for title in DEFAULT_POLICY_TITLES:
            if title.lower() in existing:
                continue
            policy_id = str(uuid4())
            version_id = str(uuid4())
            await conn.execute(
                """
                INSERT INTO policies (id, title, owner_role, status, created_at, updated_at)
                VALUES ($1,$2,$3,$4,NOW(),NOW())
                """,
                policy_id,
                title,
                DEFAULT_POLICY_OWNER,
                DEFAULT_POLICY_STATUS,
            )
            await conn.execute(
                """
                INSERT INTO policy_versions (
                  id, policy_id, version_label, content, status, created_at
                )
                VALUES ($1,$2,$3,$4,$5,NOW())
                """,
                version_id,
                policy_id,
                DEFAULT_POLICY_VERSION,
                _policy_content(title),
                DEFAULT_POLICY_STATUS,
            )
            inserted += 1

    return inserted
