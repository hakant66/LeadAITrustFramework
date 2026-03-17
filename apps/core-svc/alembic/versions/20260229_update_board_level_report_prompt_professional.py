"""Update board-level report prompt for professional tables and narrative

Revision ID: 20260229_board_level_report_professional
Revises: 20260228_add_board_level_deck_prompt
Create Date: 2026-02-29

Instructs the LLM to produce a board-ready report with proper markdown tables
and professional narrative (OpenAI-friendly).
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20260229_board_level_report_professional"
down_revision = "20260228_add_board_level_deck_prompt"
branch_labels = None
depends_on = None

PROMPT_KEY = "board-level-report"

NEW_PROMPT_TEXT = """You are a senior AI governance advisor preparing a board-level report for the C-suite. Use only the provided ENTITY DATA (JSON); do not invent metrics or facts. Write in a professional, concise, board-ready tone.

OUTPUT FORMAT: Valid Markdown only. Use the exact structure below.

# Board-Level AI Governance Summary: $Entity Name

## Executive Summary
Write 3–5 short paragraphs (not bullets) that summarise: (1) overall governance posture and risk classification, (2) portfolio health and priority projects, (3) policy and control readiness, (4) top risks, (5) recommended next steps. Use clear, formal language suitable for a board pack.

## Portfolio Overview
First, one short paragraph summarising project count and status mix. Then a **markdown table** with columns: **Status** | **Count** | **Notes**. One row per status (e.g. Active, Planned, Experimental) from the data. Add a row for high-priority items if any.

## AI Systems Snapshot
One short paragraph, then a **markdown table**: **Risk Tier** | **Count** | **Examples (names)**. Summarise AI systems by risk_tier from the data. If lifecycle_stage is present, add a brief sentence on lifecycle mix.

## Policy & Compliance Status
One paragraph on policy coverage, review status, and overdue reviews. Then a **markdown table**: **Policy Status** | **Count** (e.g. Active, Draft, Under review). If policy_review_overdue or policy_alert data exists, mention it in the paragraph.

## Controls & Evidence Readiness
One paragraph on control ownership and evidence. Then a **markdown table**: **Metric** | **Value** with rows: Total controls, With owner assigned, With due date, With evidence. Use only the controls object from the data.

## Key Risks & Issues
Write 4–6 short paragraphs (or numbered points), each one sentence, tied directly to the data: e.g. limited control ownership, draft policies, high-risk systems, experimental projects, lack of evidence. Be specific and actionable.

## Next Steps (90 Days)
One short intro sentence. Then a **markdown table** with columns: **Priority** | **Action** | **Owner** | **Due Date** | **Rationale**. Provide 4–6 concrete actions (e.g. finalise draft policies, assign control owners, review high-risk systems, gather evidence). Use Priority: High / Medium / Low. Owner and Due Date can be "TBD" if not in the data. Rationale should be one short phrase per row.

STYLE RULES:
- Use proper markdown tables: header row, then separator line (e.g. |---||---|), then data rows. No empty table cells where avoidable.
- If a section has no data, write "Data not available" in one sentence and omit the table for that section.
- Do not output raw JSON or code blocks. Output only the markdown report.
- Use bold for table column headers in the first row (**Status** | **Count**).

ENTITY CONTEXT:
Entity Name: $Entity Name
Entity Slug: $Entity Slug
Primary Role: $Primary Role
Risk Classification: $Risk Classification

ENTITY DATA (JSON) will follow below. Base the report strictly on this data."""


def upgrade() -> None:
    bind = op.get_bind()
    # Update the active version's prompt_text for board-level-report
    bind.execute(
        sa.text("""
            UPDATE llm_prompt_versions v
            SET prompt_text = :prompt_text
            FROM llm_prompt_templates t
            WHERE t.key = :key
              AND v.template_id = t.id
              AND v.id = t.active_version_id
        """),
        {"prompt_text": NEW_PROMPT_TEXT, "key": PROMPT_KEY},
    )


def downgrade() -> None:
    # Reverting would require storing the old prompt; leave no-op for simplicity
    pass
