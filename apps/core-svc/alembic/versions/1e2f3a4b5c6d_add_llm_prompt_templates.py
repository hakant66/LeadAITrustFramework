# apps/core-svc/alembic/versions/20260215_add_llm_prompt_templates.py
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import uuid

# --- Alembic identifiers ---
revision = "1e2f3a4b5c6d"
down_revision = "1d2e3f4a5b6c"
branch_labels = None
depends_on = None


PROMPT_KEY = "governance_requirements_report"
PROMPT_NAME = "Governance Requirements Report"
PROMPT_DESCRIPTION = "LLM prompt for AI Project Governance & Compliance report based on selected frameworks."
PROMPT_TEXT = """Role: Act as a Senior AI Governance & Compliance Lead. Task: Generate a comprehensive AI Project Governance & Compliance Report for the project described below.
Project Context:
Project Name: $Project Name
Company Role: $Entity Name
Risk Classification: Risk Classification (from assessment)
Primary Role: Primary Role (from assessment)
Chosen Governance Frameworks: [EU AI Act / ISO 42001 / NIST AI RMF / Internal] chosen from the Add governance to project card
Report Requirements & Structure:

Executive Summary: Briefly state the project's purpose and its compliance posture relative to its role and risk level.

Regulatory & Standard Mapping (Governance Logic):

EU AI Act Requirements: Based on the risk level and role, list the specific obligations (e.g., Article 17 QMS for Providers, Article 26 for Deployers).

ISO 42001 (AIMS) Alignment: Map the project to relevant clauses (e.g., Clause 6.1 for Risk, Clause 8.2 for Data Quality).

NIST AI RMF Integration: Categorize the governance actions under the four NIST functions: Govern, Map, Measure, and Manage.

KPI Performance Dashboard: * Create a table linking the provided KPIs to their respective NIST function and ISO clause.

Analyze the current KPI values against typical industry benchmarks for [High-Risk / Non-High-Risk] systems.

Risk-Based Action Plan:

If [High-Risk], detail the requirements for "Human Oversight" and "Technical Documentation."

Identify "Gap Areas" where current KPIs might need enhancement to meet EU AI Act certification standards.

Conclusion & Road-to-Certification: Provide 3 immediate next steps to achieve full alignment with the selected frameworks.

Tone: Professional, authoritative, and audit-ready."""


def upgrade() -> None:
    op.create_table(
        "llm_prompt_templates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("key", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("active_version_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "created_at",
            postgresql.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            postgresql.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("key", name="uq_llm_prompt_templates_key"),
    )
    op.create_index(
        "ix_llm_prompt_templates_key",
        "llm_prompt_templates",
        ["key"],
        unique=True,
    )

    op.create_table(
        "llm_prompt_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "template_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("llm_prompt_templates.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("language", sa.Text(), nullable=False, server_default=sa.text("'en'")),
        sa.Column("prompt_text", sa.Text(), nullable=False),
        sa.Column("variables", postgresql.JSONB, nullable=True),
        sa.Column(
            "created_at",
            postgresql.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("created_by", sa.Text(), nullable=True),
    )
    op.create_index(
        "ix_llm_prompt_versions_template_id",
        "llm_prompt_versions",
        ["template_id"],
        unique=False,
    )

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

    op.create_foreign_key(
        "fk_llm_prompt_templates_active_version",
        "llm_prompt_templates",
        "llm_prompt_versions",
        ["active_version_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_llm_prompt_templates_active_version",
        "llm_prompt_templates",
        type_="foreignkey",
    )
    op.drop_index("ix_llm_prompt_versions_template_id", table_name="llm_prompt_versions")
    op.drop_table("llm_prompt_versions")
    op.drop_index("ix_llm_prompt_templates_key", table_name="llm_prompt_templates")
    op.drop_table("llm_prompt_templates")
