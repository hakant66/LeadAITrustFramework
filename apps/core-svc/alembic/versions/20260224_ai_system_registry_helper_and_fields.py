"""AI System Register: rename Vendor to Model Provider, add new fields and helper table

Revision ID: 20260224_ai_system_registry_helper
Revises: 20260223_add_ai_summary_llm
Create Date: 2026-02-24

- Rename vendor -> model_provider in ai_system_registry and ai_system_translations
- Add new columns to ai_system_registry and ai_system_translations
- Create ai_system_registry_helper and seed dropdown options
"""
from __future__ import annotations

import json
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260224_ai_system_registry_helper"
down_revision = "20260223_add_ai_summary_llm"
branch_labels = None
depends_on = None


# Helper data: field_name (snake_case), description, list of dropdown options
HELPER_ROWS = [
    ("model_provider", "Entity that developed the model.", ["OpenAI", "Anthropic", "Meta", "Google", "Mistral", "Microsoft", "Internal (In-house)"]),
    ("model_name", "The specific brand name.", ["GPT-4o", "Claude 3.5", "Llama 3", "Gemini Pro", "Titan", "Mistral Large"]),
    ("model_version", "The specific iteration or date.", ["v1.0", "2024-05-13", "Latest-Stable", "Snapshot-v2", '"Turbo"']),
    ("technical_lead", "Person/Role accountable.", ["[Name]", "CTO", "Lead Data Scientist", "AI Engineer", "Head of Infrastructure"]),
    ("target_users", "Who uses the system?", ["Internal Employees", "Customers (B2C)", "B2B Clients", "DevOps Team", "QA"]),
    ("intended_purpose", "The primary business goal.", ["Code Generation", "Customer Support Chatbot", "Document Summarization", "Translation"]),
    ("out_of_scope_uses", "Prohibited applications.", ["Medical Advice", "Financial Planning", "Legal Counseling", "Automated Hiring"]),
    ("deployment_method", "Infrastructure setup.", ["Public API (SaaS)", "Private VPC", "On-Premise", "Edge (Local Device)", "Hybrid"]),
    ("data_residency", "Where data is processed/stored.", ["EU (Ireland)", "US (East)", "Germany", "Global (Multi-region)", "On-site Server"]),
    ("base_model_type", "Architectural foundation.", ["General Purpose LLM", "Fine-tuned (SFT)", "RAG-Enabled", "SLM (Small Language Model)"]),
    ("input_output_modality", "Communication format.", ["Text-to-Text", "Image-to-Text (Multimodal)", "Text-to-Code", "Audio-to-Text"]),
    ("fine_tuning_data", "Data used for refinement.", ["N/A (Base Model)", "Synthetic Data", "Internal Wiki", "Customer Support Logs (Anonymized)"]),
    ("data_minimization", "Privacy controls applied.", ["PII Masking", "Synthetic Data", "Prompt Scrubbing", "No-Logging Policy (API)"]),
    ("human_oversight_mechanism", "Control mechanism.", ["Human-in-the-Loop (HITL)", "Post-hoc Audit", "User Feedback/Flagging", "None"]),
    ("impact_assessment_reference", "Documentation link.", ["AISIA-2024-001", "DPIA-Legal-v2", "[Internal SharePoint Link]"]),
    ("known_limitations", "Technical weaknesses.", ["Hallucinations", "4k Context Limit", "Knowledge Cutoff (Jan 2024)", "English-only"]),
]


def upgrade() -> None:
    # ----- ai_system_registry: rename vendor -> model_provider -----
    op.alter_column(
        "ai_system_registry",
        "vendor",
        new_column_name="model_provider",
        existing_type=sa.Text(),
    )

    # ----- ai_system_registry: add new columns -----
    new_columns = [
        ("model_name", sa.Text(), None),
        ("technical_lead", sa.Text(), None),
        ("target_users", sa.Text(), None),
        ("intended_purpose", sa.Text(), None),
        ("out_of_scope_uses", sa.Text(), None),
        ("deployment_method", sa.Text(), None),
        ("data_residency", sa.Text(), None),
        ("base_model_type", sa.Text(), None),
        ("input_output_modality", sa.Text(), None),
        ("fine_tuning_data", sa.Text(), None),
        ("data_minimization", sa.Text(), None),
        ("human_oversight_mechanism", sa.Text(), None),
        ("impact_assessment_reference", sa.Text(), None),
        ("known_limitations", sa.Text(), None),
    ]
    for col_name, col_type, _ in new_columns:
        op.add_column("ai_system_registry", sa.Column(col_name, col_type, nullable=True))

    # ----- ai_system_translations: rename vendor -> model_provider -----
    op.alter_column(
        "ai_system_translations",
        "vendor",
        new_column_name="model_provider",
        existing_type=sa.Text(),
    )

    # ----- ai_system_translations: add new columns -----
    for col_name, col_type, _ in new_columns:
        op.add_column("ai_system_translations", sa.Column(col_name, col_type, nullable=True))

    # ----- Create helper table -----
    op.create_table(
        "ai_system_registry_helper",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("field_name", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("helper_values", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_ai_system_registry_helper_field_name",
        "ai_system_registry_helper",
        ["field_name"],
        unique=True,
    )

    # ----- Insert helper data -----
    def esc(s: str) -> str:
        return (s or "").replace("'", "''")

    for field_name, description, values in HELPER_ROWS:
        vals_json = json.dumps(values).replace("'", "''")
        op.execute(
            f"INSERT INTO ai_system_registry_helper (field_name, description, helper_values) "
            f"VALUES ('{esc(field_name)}', '{esc(description)}', '{vals_json}'::jsonb)"
        )


def downgrade() -> None:
    op.drop_index("ix_ai_system_registry_helper_field_name", table_name="ai_system_registry_helper")
    op.drop_table("ai_system_registry_helper")

    new_column_names = [
        "model_name", "technical_lead", "target_users", "intended_purpose",
        "out_of_scope_uses", "deployment_method", "data_residency", "base_model_type",
        "input_output_modality", "fine_tuning_data", "data_minimization",
        "human_oversight_mechanism", "impact_assessment_reference", "known_limitations",
    ]
    for col_name in reversed(new_column_names):
        op.drop_column("ai_system_translations", col_name)
        op.drop_column("ai_system_registry", col_name)

    op.alter_column(
        "ai_system_translations",
        "model_provider",
        new_column_name="vendor",
        existing_type=sa.Text(),
    )
    op.alter_column(
        "ai_system_registry",
        "model_provider",
        new_column_name="vendor",
        existing_type=sa.Text(),
    )
