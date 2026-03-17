"""Add board-level deck prompt template

Revision ID: 20260228_add_board_level_deck_prompt
Revises: 20260228_add_board_level_report_prompt
Create Date: 2026-02-28
"""
from __future__ import annotations

import uuid
from alembic import op
import sqlalchemy as sa

revision = "20260228_add_board_level_deck_prompt"
down_revision = "20260228_add_board_level_report_prompt"
branch_labels = None
depends_on = None

PROMPT_KEY = "board-level-report-deck"
PROMPT_NAME = "Board-Level Governance Deck (LLM)"
PROMPT_DESCRIPTION = (
    "LLM prompt for the board-level governance presentation deck. "
    "Outputs JSON slides for the HTML deck renderer."
)
PROMPT_TEXT = """You are a board-level AI governance advisor preparing a presentation deck.
Use only the provided data; do not invent metrics or facts.

OUTPUT FORMAT:
- Return STRICT JSON only (no markdown, no code fences).
- JSON schema:
{
  "title": "Deck title",
  "subtitle": "Entity name + date",
  "slides": [
    {
      "title": "Slide title",
      "subtitle": "Optional",
      "bullets": ["Bullet 1", "Bullet 2"],
      "metrics": [{"label": "Label", "value": "Value"}],
      "table": {
        "columns": ["Col1", "Col2", "Col3"],
        "rows": [["a","b","c"], ["d","e","f"]]
      },
      "callouts": ["Short callout text"],
      "notes": "Optional speaker note"
    }
  ]
}

REQUIREMENTS:
- Provide 8–10 slides total.
- Include slides for: Executive Summary, Portfolio Overview, AI Systems Snapshot,
  Policy & Compliance Status, Controls & Evidence Readiness, Key Risks & Issues,
  Next Steps (table), and Decision/Ask.
- Keep bullets concise (max 5 per slide).
- If data is missing, say "Data not available".

ENTITY CONTEXT:
Entity Name: $Entity Name
Entity Slug: $Entity Slug
Primary Role: $Primary Role
Risk Classification: $Risk Classification

ENTITY DATA (JSON) will follow below. Use it to write the deck.
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
