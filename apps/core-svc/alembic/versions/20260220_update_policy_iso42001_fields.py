"""update policy iso42001, comment, and action fields

Revision ID: 20260220_update_policy_iso42001_fields
Revises: 20260220_update_system_requirements_policy_id
Create Date: 2026-02-20
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260220_update_policy_iso42001_fields"
down_revision = "20260220_update_system_requirements_policy_id"
branch_labels = None
depends_on = None


POLICY_UPDATES = [
    {
        "title": "AI Governance Policy",
        "iso": "Clause 5.2",
        "comment": 'This is the core "AI Policy" required by the standard.',
        "action": "Create an AI Policy document for the company.",
    },
    {
        "title": "AI Regulatory Compliance Policy",
        "iso": "Clause 4.2 / Annex A.3",
        "comment": "You must document how you identify and comply with legal requirements (like the EU AI Act).",
        "action": 'Create an AI Regulatory Compliance Policy which is your "Legal Shield." It focuses on external mandates, especially mapping your actions to laws like the EU AI Act, GDPR, and local sector requirements.',
    },
    {
        "title": "AI Requirements Register",
        "iso": "Clause 6.2 / Annex A.2",
        "comment": "You must have a controlled process for deploying AI systems into production.",
        "action": 'Create a "Master Inventory" (Excel/Database) listing every AI tool, its data sensitivity, and its assigned "Risk Level" (e.g., EU AI Act Tiers)',
    },
    {
        "title": "AI Transparency and User Notice Policy",
        "iso": "Clause 8.5 / Annex A.8",
        "comment": "Required to ensure users are aware they are interacting with an AI (aligns with EU AI Act).",
        "action": 'Implement UI Disclosures. Deploy mandatory banners or "Powered by AI" labels on chatbots and generated reports to inform end-users.',
    },
    {
        "title": "Model Approval and Release Policy",
        "iso": "Clause 8.3 / Annex A.6",
        "comment": "You must maintain an inventory of AI systems and their specific requirements/objectives.",
        "action": 'Establish a "Stage-Gate" Workflow. Require a signed "Readiness Checklist" (covering safety and accuracy) before any model is moved from dev to prod.',
    },
    {
        "title": "Responsible AI Principles",
        "iso": "Clause 5.2",
        "comment": 'These are not named as "Policies" in the standard, but you cannot meet the requirements of the clauses without documenting these processes.',
        "action": 'Publish a "Statement of Intent." Create a public-facing web page or internal landing page declaring your commitment to non-discrimination and safety.',
    },
    {
        "title": "AI Ethical Use Charter",
        "iso": "Clause 5.3",
        "comment": 'These are not named as "Policies" in the standard, but you cannot meet the requirements of the clauses without documenting these processes.',
        "action": "Form an Ethics Committee. Hold quarterly meetings with stakeholders from Legal, HR, and Engineering to review high-impact AI use cases.",
    },
    {
        "title": "AI Documentation and Traceability Policy",
        "iso": "Clause 7.5 / Annex A.7",
        "comment": 'These are not named as "Policies" in the standard, but you cannot meet the requirements of the clauses without documenting these processes.',
        "action": 'Generate "Model Cards." Standardize documentation for every model that includes training data provenance, version history, and known failure modes.',
    },
    {
        "title": "AI Workforce Training and Literacy Policy",
        "iso": "Clause 7.2 / Clause 7.3",
        "comment": 'These are not named as "Policies" in the standard, but you cannot meet the requirements of the clauses without documenting these processes.',
        "action": 'Deploy LMS Training Units. Enroll all employees in an "AI Literacy 101" course and track completion certificates as audit artifacts.',
    },
    {
        "title": "HR Hiring and Screening AI Policy",
        "iso": "Annex A.9",
        "comment": "Mandatory if the AI itself is being used for hiring (which makes it High-Risk under the EU AI Act).",
        "action": 'Conduct Bias Audits. For any AI used in HR, perform an annual "Disparate Impact Analysis" to ensure it isn\'t filtering candidates based on protected classes.',
    },
    {
        "title": "Shadow AI Detection and Reporting Policy",
        "iso": "Clause 4.3",
        "comment": "If employees use unmanaged AI, it breaks your scope. This policy helps you maintain control, but you could simply include it as a paragraph in your main AI Policy.",
        "action": 'Establish a "Shadow AI" Governance Policy explicitly bans or regulates the use of unauthorized LLMs (like personal ChatGPT accounts) for company data. Audit Network Traffic Logs. Configure your Firewall/CASB to detect and block traffic to unauthorized LLM domains (e.g., non-enterprise versions of AI tools).',
    },
]


def upgrade() -> None:
    conn = op.get_bind()
    for row in POLICY_UPDATES:
        conn.execute(
            sa.text(
                """
                UPDATE policies
                SET iso42001_requirement = :iso,
                    comment = :comment,
                    action = :action,
                    updated_at = NOW()
                WHERE title = :title
                """
            ),
            row,
        )


def downgrade() -> None:
    conn = op.get_bind()
    for row in POLICY_UPDATES:
        conn.execute(
            sa.text(
                """
                UPDATE policies
                SET iso42001_requirement = NULL,
                    comment = NULL,
                    action = NULL,
                    updated_at = NOW()
                WHERE title = :title
                """
            ),
            {"title": row["title"]},
        )
