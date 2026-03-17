"""Add board-level report prompt template

Revision ID: 20260228_add_board_level_report_prompt
Revises: 20260228_add_llm_report_schedule
Create Date: 2026-02-28
"""
from __future__ import annotations

import uuid
from alembic import op
import sqlalchemy as sa

revision = "20260228_add_board_level_report_prompt"
down_revision = "20260228_add_llm_report_schedule"
branch_labels = None
depends_on = None

PROMPT_KEY = "board-level-report"
PROMPT_NAME = "Board-Level Governance Summary (LLM)"
PROMPT_DESCRIPTION = (
    "LLM prompt for the entity-wide board-level governance summary report. "
    "Aggregates portfolio, policy, and control posture into executive guidance."
)
PROMPT_TEXT = """You are a board-level AI governance advisor preparing a concise executive summary.
Use only the provided data; do not invent metrics or facts.

REPORT STRUCTURE (use exact Markdown headings):

# Board-Level AI Governance Summary: $Entity Name

## Executive Summary
- 3-5 bullet points on overall governance posture and key risks.

## Portfolio Overview
- Summarize project count and status mix.
- Highlight any high-risk or priority items.

## AI Systems Snapshot
- Summarize number of AI systems and notable risk tiers or lifecycle stages.

## Policy & Compliance Status
- Summarize policy coverage, review status, and overdue reviews.
- Mention any critical policy alerts.

## Controls & Evidence Readiness
- Summarize control readiness (owners, due dates, evidence coverage).

## Key Risks & Issues
- 3-6 bullets, each tied to data in the input.

## Next Steps (90 Days)
Provide a table:
| Priority | Action | Owner | Due Date | Rationale |

STYLE REQUIREMENTS:
- Board-friendly, concise language.
- Use bullet points and tables.
- If data is missing, state 'Data not available'.

ENTITY CONTEXT:
Entity Name: $Entity Name
Entity Slug: $Entity Slug
Primary Role: $Primary Role
Risk Classification: $Risk Classification

ENTITY DATA (JSON) will follow below. Use it to write the report.
"""


def upgrade() -> None:
    template_id = uuid.uuid4()
    version_id = uuid.uuid4()
    bind = op.get_bind()

    bind.execute(
        sa.text(
            """
            INSERT INTO llm_prompt_templates (id, key, name, description, active_version_id, is_active)
            VALUES (:id, :key, :name, :description, NULL, true)
            ON CONFLICT (key) DO NOTHING
            """
        ),
        {
            "id": template_id,
            "key": PROMPT_KEY,
            "name": PROMPT_NAME,
            "description": PROMPT_DESCRIPTION,
        },
    )

    template_row = bind.execute(
        sa.text("SELECT id FROM llm_prompt_templates WHERE key = :key"),
        {"key": PROMPT_KEY},
    ).fetchone()
    if not template_row:
        return
    template_id = template_row[0]

    bind.execute(
        sa.text(
            """
            INSERT INTO llm_prompt_versions (id, template_id, version, language, prompt_text, variables, created_by)
            VALUES (:id, :template_id, :version, :language, :prompt_text, :variables, :created_by)
            """
        ),
        {
            "id": version_id,
            "template_id": template_id,
            "version": 1,
            "language": "en",
            "prompt_text": PROMPT_TEXT,
            "variables": None,
            "created_by": "system",
        },
    )

    bind.execute(
        sa.text(
            """
            UPDATE llm_prompt_templates
            SET active_version_id = :version_id
            WHERE id = :template_id
            """
        ),
        {"version_id": version_id, "template_id": template_id},
    )


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(sa.text("DELETE FROM llm_prompt_templates WHERE key = :key"), {"key": PROMPT_KEY})
