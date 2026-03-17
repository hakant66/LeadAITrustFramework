"""Add ISO42001 maturity levels and map ISO requirements

Revision ID: 0f2a3b4c5d6e
Revises: e5f6a7b8c9d0
Create Date: 2026-02-15
"""

from alembic import op
import sqlalchemy as sa


revision = "0f2a3b4c5d6e"
down_revision = "e5f6a7b8c9d0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "iso42001_maturitylevel",
        sa.Column("level", sa.Text(), primary_key=True),
    )

    op.execute(
        """
        INSERT INTO iso42001_maturitylevel (level) VALUES
          ('Level 1: Initial'),
          ('Level 2: Managed'),
          ('Level 3: Defined'),
          ('Level 4: Managed'),
          ('Level 5: Optimizing')
        """
    )

    op.add_column(
        "iso42001",
        sa.Column("maturity_level", sa.Text(), nullable=True),
    )
    op.create_foreign_key(
        "fk_iso42001_maturity_level",
        "iso42001",
        "iso42001_maturitylevel",
        ["maturity_level"],
        ["level"],
        ondelete="SET NULL",
    )

    op.execute(
        """
        UPDATE iso42001
        SET maturity_level = 'Level 1: Initial'
        WHERE content IN (
          'Determine internal and external issues relevant to AI objectives and outcomes',
          'Identify interested parties and their AI-related expectations'
        )
        """
    )

    op.execute(
        """
        UPDATE iso42001
        SET maturity_level = 'Level 2: Managed'
        WHERE content IN (
          'Provide resources necessary for AI governance',
          'Control AI-related documentation',
          'Define and control intended use of AI systems'
        )
        """
    )

    op.execute(
        """
        UPDATE iso42001
        SET maturity_level = 'Level 3: Defined'
        WHERE content IN (
          'Establish, implement, maintain, and improve an AI Management System',
          'Define and document scope of the AI Management System',
          'Top management must demonstrate leadership and accountability for AI governance',
          'Establish and maintain an AI policy aligned with organisational goals',
          'Assign AI governance roles, authorities, and responsibilities',
          'Identify and address AI risks and opportunities',
          'Define measurable AI objectives and plans to achieve them',
          'Ensure personnel involved in AI are competent',
          'Ensure awareness of AI risks, policies, and responsibilities',
          'Plan and control AI lifecycle processes',
          'Ensure quality, relevance, and bias controls in data',
          'Govern design and development of AI systems',
          'Ensure appropriate AI transparency',
          'Implement human oversight measures',
          'Ensure accuracy, robustness, reliability',
          'Protect AI systems from attacks and misuse',
          'Manage AI-related supplier risks'
        )
        """
    )

    op.execute(
        """
        UPDATE iso42001
        SET maturity_level = 'Level 4: Managed'
        WHERE content IN (
          'Monitor AI performance and behaviour',
          'Measure AI governance effectiveness',
          'Conduct internal audits of AIMS',
          'Top management reviews AIMS performance',
          'Detect, investigate, and respond to AI incidents'
        )
        """
    )

    op.execute(
        """
        UPDATE iso42001
        SET maturity_level = 'Level 5: Optimizing'
        WHERE content IN (
          'Address AI governance failures systematically',
          'Continually improve AI governance'
        )
        """
    )


def downgrade() -> None:
    op.drop_constraint("fk_iso42001_maturity_level", "iso42001", type_="foreignkey")
    op.drop_column("iso42001", "maturity_level")
    op.drop_table("iso42001_maturitylevel")
