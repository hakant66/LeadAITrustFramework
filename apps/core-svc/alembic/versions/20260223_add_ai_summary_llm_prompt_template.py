"""Add ai_summary_llm prompt template (Executive / AI Project Summary LLM)

Revision ID: 20260223_add_ai_summary_llm
Revises: 20260222_fix_entity_legal_standing_result_type
Create Date: 2026-02-23

Uses same llm_prompt_templates / llm_prompt_versions tables.
Variables in prompt: $Project Name, $Project Slug, $Overall Score,
$Pillar Performance, $Lowest Performing KPIs.
"""
from __future__ import annotations

import uuid
from alembic import op
import sqlalchemy as sa

revision = "20260223_add_ai_summary_llm"
down_revision = "20260222_fix_entity_legal_standing_result_type"
branch_labels = None
depends_on = None

PROMPT_KEY = "ai_summary_llm"
PROMPT_NAME = "Executive / AI Project Summary (LLM)"
PROMPT_DESCRIPTION = "LLM prompt for the Executive Report shown on the project report page and used by batch report generation. Cached in llm_report_cache."
PROMPT_TEXT = """You are a senior AI governance consultant producing an executive report in McKinsey & Company style.
The report must be precise, data-driven, and action-oriented with clear accountability.

REPORT STRUCTURE (use exact Markdown headings):

# Executive Report: [Project Name]

## Executive Summary
- Provide a concise 2-3 sentence overview of the project's AI governance posture
- State the overall trust score and key risk areas
- Highlight the most critical governance gaps

## Key Findings
- List 3-5 critical findings based on pillar scores and KPI performance
- Each finding should be data-backed (cite specific scores/metrics)
- Use bullet points with clear, concise statements

## Prioritized Action Plan
- Present actions in a structured table format:
  | Priority | Action | Owner | Due Date | Status |
  |----------|--------|-------|----------|--------|
- Priority: Critical / High / Medium / Low
- Action: Specific, measurable action item
- Owner: Assign based on KPI owner_role when available, else suggest appropriate role (e.g., 'Data Governance Lead', 'AI Risk Manager', 'Compliance Officer')
- Due Date: Suggest realistic dates (e.g., '2026-03-15' for critical items within 30 days, '2026-04-30' for high priority within 60 days, '2026-06-30' for medium within 90 days)
- Status: 'Not Started' for all new actions
- Focus on the lowest-scoring pillars and KPIs
- Include 5-8 action items total

## Next Steps
- List 3-4 immediate next steps (next 2 weeks)
- Each step should have:
  - Specific action
  - Accountable role/profile
  - Target completion date

## Risk Summary by Pillar
- For each pillar, provide:
  - Current score and status
  - Key risks identified
  - Impact if not addressed

STYLE REQUIREMENTS:
- Use professional, executive-level language
- Be precise and data-driven (cite specific percentages and metrics)
- Avoid vague statements; use concrete facts
- Format tables cleanly with proper Markdown
- Use bullet points for lists
- Keep paragraphs concise (2-3 sentences max)
- Do not invent metrics or data not provided
- If data is missing, state 'Data not available' rather than guessing

PROJECT DATA:
Project Name: $Project Name
Project Slug: $Project Slug
Overall Trust Score: $Overall Score

Pillar Performance:
$Pillar Performance

Lowest-Performing KPIs (require immediate attention):
$Lowest Performing KPIs

Generate the report now following the structure above:"""


def upgrade() -> None:
    template_id = uuid.uuid4()
    version_id = uuid.uuid4()
    bind = op.get_bind()

    bind.execute(
        sa.text(
            """
            INSERT INTO llm_prompt_templates (id, key, name, description, active_version_id, is_active)
            VALUES (:id, :key, :name, :description, NULL, true)
            """
        ),
        {
            "id": template_id,
            "key": PROMPT_KEY,
            "name": PROMPT_NAME,
            "description": PROMPT_DESCRIPTION,
        },
    )

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
