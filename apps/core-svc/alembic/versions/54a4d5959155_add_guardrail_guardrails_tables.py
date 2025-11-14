"""add guardrail guardrails tables

Revision ID: 54a4d5959155
Revises: 85ea2ba8269f
Create Date: 2025-11-12 12:10:11.682877

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from sqlalchemy.dialects import postgresql as psql



# revision identifiers, used by Alembic.
revision: str = '54a4d5959155'
down_revision: Union[str, Sequence[str], None] = '85ea2ba8269f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    # extension for gen_random_uuid()
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto;")

    # ---- guardrail_fact_sources ------------------------------------------------
    op.create_table(
        "guardrail_fact_sources",
        sa.Column("fact_key", sa.Text(), primary_key=True),
        sa.Column("source", sa.Text(), nullable=False),
        sa.Column("kpi_key", sa.Text(), nullable=True),
        sa.Column("attr_key", sa.Text(), nullable=True),
        sa.Column("present_threshold", sa.Numeric(), nullable=True),
        schema="public",
    )
    op.create_check_constraint(
        "ck_guardrail_fact_sources_source",
        "guardrail_fact_sources",
        "source IN ('kpi','project_attr')",
        schema="public",
    )
    op.create_index(
        "ix_guardrail_fact_sources_source",
        "guardrail_fact_sources",
        ["source"],
        unique=False,
        schema="public",
    )

    # ---- guardrail_rules -------------------------------------------------------
    op.create_table(
        "guardrail_rules",
        sa.Column(
            "id",
            psql.UUID(as_uuid=False),
            server_default=sa.text("gen_random_uuid()"),
            primary_key=True,
        ),
        sa.Column("pillar_key", sa.Text(), nullable=False),
        sa.Column("cap", sa.Numeric(), nullable=False),
        sa.Column("rule", psql.JSONB(), nullable=False),
        sa.Column("is_enabled", sa.Boolean(), nullable=True, server_default=sa.text("true")),
        schema="public",
    )
    op.create_index(
        "ix_guardrail_rules_pillar_key",
        "guardrail_rules",
        ["pillar_key"],
        unique=False,
        schema="public",
    )
    op.create_index(
        "ix_guardrail_rules_is_enabled",
        "guardrail_rules",
        ["is_enabled"],
        unique=False,
        schema="public",
    )

    # ---- Seed data using bulk_insert (safe JSON) -------------------------------
    fact_sources = sa.table(
        "guardrail_fact_sources",
        sa.column("fact_key", sa.Text()),
        sa.column("source", sa.Text()),
        sa.column("kpi_key", sa.Text()),
        sa.column("attr_key", sa.Text()),
        sa.column("present_threshold", sa.Numeric()),
    )
    op.bulk_insert(
        fact_sources,
        [
            {"fact_key": "has_pcl",       "source": "kpi", "kpi_key": "pcl_assigned",                    "attr_key": None, "present_threshold": 100},
            {"fact_key": "has_annex",     "source": "kpi", "kpi_key": "annex_iv_completeness_pct",       "attr_key": None, "present_threshold": 1},
            {"fact_key": "has_factsheet", "source": "kpi", "kpi_key": "trust_factsheet_completeness_pct","attr_key": None, "present_threshold": 1},
        ],
    )

    rules = sa.table(
        "guardrail_rules",
        sa.column("pillar_key", sa.Text()),
        sa.column("cap", sa.Numeric()),
        sa.column("rule", psql.JSONB()),
        sa.column("is_enabled", sa.Boolean()),
    )
    op.bulk_insert(
        rules,
        [
            {
                "pillar_key": "gov",
                "cap": 40,
                "rule": {"all_of": [{"fact": "has_pcl", "op": "==", "value": 0}]},
                "is_enabled": True,
            },
            {
                "pillar_key": "tct",
                "cap": 50,
                "rule": {
                    "any_of": [
                        {"fact": "has_annex", "op": "==", "value": 0},
                        {"fact": "has_factsheet", "op": "==", "value": 0},
                    ]
                },
                "is_enabled": True,
            },
        ],
    )



def downgrade():
    op.drop_index("ix_guardrail_rules_is_enabled", table_name="guardrail_rules", schema="public")
    op.drop_index("ix_guardrail_rules_pillar_key", table_name="guardrail_rules", schema="public")
    op.drop_table("guardrail_rules", schema="public")

    op.drop_index("ix_guardrail_fact_sources_source", table_name="guardrail_fact_sources", schema="public")
    op.drop_constraint("ck_guardrail_fact_sources_source", "guardrail_fact_sources", schema="public", type_="check")
    op.drop_table("guardrail_fact_sources", schema="public")
