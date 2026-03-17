"""Backfill policy EU AI Act + NIST AI RMF requirements by title

Revision ID: 20260221_backfill_policy_euai_nist_by_title
Revises: 20260221_add_policy_euai_nist_requirements
Create Date: 2026-02-21
"""
from __future__ import annotations

from alembic import op


revision = "20260221_backfill_policy_euai_nist_by_title"
down_revision = "20260221_add_policy_euai_nist_requirements"
branch_labels = None
depends_on = None


POLICY_TITLES = (
    "AI Governance Policy",
    "AI Regulatory Compliance Policy",
    "AI Requirements Register",
    "AI Transparency and User Notice Policy",
    "Model Approval and Release Policy",
    "Responsible AI Principles",
    "AI Ethical Use Charter",
    "AI Documentation and Traceability Policy",
    "AI Documentation and Traceability",
    "AI Workforce Training and Literacy Policy",
    "HR Hiring and Screening AI Policy",
    "Shadow AI Detection and Reporting Policy",
)


def _update_table(table: str, title_col: str) -> None:
    title_list = ",".join([f"'{t}'" for t in POLICY_TITLES])
    op.execute(
        f"""
        UPDATE {table}
        SET
          euaiact_requirements = CASE
            WHEN {title_col} = 'AI Regulatory Compliance Policy' THEN 'General Req.'
            WHEN {title_col} = 'AI Requirements Register' THEN 'Article 60'
            WHEN {title_col} = 'AI Transparency and User Notice Policy' THEN 'Article 50'
            WHEN {title_col} = 'Model Approval and Release Policy' THEN 'Article 11'
            WHEN {title_col} IN ('AI Documentation and Traceability Policy', 'AI Documentation and Traceability') THEN 'Article 11'
            WHEN {title_col} = 'AI Workforce Training and Literacy Policy' THEN 'Article 4'
            WHEN {title_col} = 'HR Hiring and Screening AI Policy' THEN 'Annex III'
            WHEN {title_col} IN ('AI Governance Policy', 'Responsible AI Principles', 'AI Ethical Use Charter', 'Shadow AI Detection and Reporting Policy') THEN NULL
            ELSE euaiact_requirements
          END,
          nistairmf_requirements = CASE
            WHEN {title_col} IN ('AI Governance Policy', 'Responsible AI Principles') THEN 'GOVERN 1.1'
            WHEN {title_col} = 'AI Regulatory Compliance Policy' THEN 'GOVERN 4.2'
            WHEN {title_col} = 'AI Requirements Register' THEN 'GOVERN 2.1'
            WHEN {title_col} = 'AI Transparency and User Notice Policy' THEN 'MEASURE 4.2'
            WHEN {title_col} = 'Model Approval and Release Policy' THEN 'MEASURE 1.1'
            WHEN {title_col} = 'AI Ethical Use Charter' THEN 'GOVERN 2.2'
            WHEN {title_col} IN ('AI Documentation and Traceability Policy', 'AI Documentation and Traceability') THEN 'MEASURE 1.2'
            WHEN {title_col} = 'AI Workforce Training and Literacy Policy' THEN 'GOVERN 1.2'
            WHEN {title_col} = 'HR Hiring and Screening AI Policy' THEN 'MAP 1.5'
            WHEN {title_col} = 'Shadow AI Detection and Reporting Policy' THEN 'MANAGE 1.1'
            ELSE nistairmf_requirements
          END
        WHERE {title_col} IN ({title_list})
        """
    )


def upgrade() -> None:
    _update_table("policies", "title")
    _update_table("entity_policy_register", "policy_title")


def downgrade() -> None:
    title_list = ",".join([f"'{t}'" for t in POLICY_TITLES])
    op.execute(
        f"""
        UPDATE policies
        SET euaiact_requirements = NULL,
            nistairmf_requirements = NULL
        WHERE title IN ({title_list})
        """
    )
    op.execute(
        f"""
        UPDATE entity_policy_register
        SET euaiact_requirements = NULL,
            nistairmf_requirements = NULL
        WHERE policy_title IN ({title_list})
        """
    )
