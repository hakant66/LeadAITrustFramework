"""add guardrail guardrails tables

Revision ID: 93714713f947
Revises: 54a4d5959155
Create Date: 2025-12-08 12:10:11.682877

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from sqlalchemy.dialects import postgresql as psql



# revision identifiers, used by Alembic.
revision: str = '93714713f947'
down_revision: Union[str, Sequence[str], None] = '54a4d5959155'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # 1) Drop kpi_values table if it exists
    # Using raw SQL with IF EXISTS for safety across environments
    op.execute("DROP TABLE IF EXISTS kpi_values CASCADE;")

    # 2) Create kpi_definition table
    op.create_table(
        "kpi_definition",
        sa.Column("kpi_id", sa.String(), nullable=False),
        sa.Column("kpi_key", sa.String(length=120), nullable=False),
        sa.Column("kpi_name", sa.String(length=200), nullable=False),
        sa.Column("pillar_id", sa.String(), nullable=False),
        sa.Column("unit", sa.String(length=40), nullable=False),
        sa.Column("weight", sa.Float(), nullable=False),
        sa.Column("min_ideal", sa.Float(), nullable=True),
        sa.Column("max_ideal", sa.Float(), nullable=True),
        sa.Column("invert", sa.Boolean(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("example", sa.Text(), nullable=True),
        sa.Column("definition", sa.Text(), nullable=True),

        sa.PrimaryKeyConstraint("kpi_id", name="kpis_pkey"),
        sa.UniqueConstraint("kpi_key", name="kpis_key_unique"),

        # FK: pillar_id → public.pillars(id)
        sa.ForeignKeyConstraint(
            ["pillar_id"],
            ["pillars.id"],
            name="fk_kpis_pillar",
            ondelete="CASCADE",
        ),

        # Optional FKs back to kpis (to mirror your intended logic)
        # If you don't want circular linkage, you can comment these out.
        sa.ForeignKeyConstraint(
            ["kpi_id"],
            ["kpis.id"],
            name="fk_kpi_definition_kpis_id",
        ),
        sa.ForeignKeyConstraint(
            ["kpi_key"],
            ["kpis.key"],
            name="fk_kpi_definition_kpis_key",
        ),
    )

    # Optional: index on kpi_key (though UniqueConstraint will create one anyway)
    op.create_index(
        "ix_kpi_definition_key",
        "kpi_definition",
        ["kpi_key"],
        unique=True,
    )

    # 3) Copy data from kpis → kpi_definition
    # Note: definition column is new; we set it to NULL for now.
    op.execute(
        """
        INSERT INTO kpi_definition (
            kpi_id,
            kpi_key,
            kpi_name,
            pillar_id,
            unit,
            weight,
            min_ideal,
            max_ideal,
            invert,
            description,
            example,
            definition
        )
        SELECT
            id          AS kpi_id,
            key         AS kpi_key,
            name        AS kpi_name,
            pillar_id   AS pillar_id,
            unit        AS unit,
            weight      AS weight,
            min_ideal   AS min_ideal,
            max_ideal   AS max_ideal,
            invert      AS invert,
            description AS description,
            example     AS example,
            NULL        AS definition
        FROM kpis;
        """
    )


def downgrade() -> None:
    # 1) Drop index & kpi_definition table
    op.drop_index("ix_kpi_definition_key", table_name="kpi_definition")
    op.drop_table("kpi_definition")

    # 2) Recreate kpi_values table (schema guessed – adjust to your original)
    # If you have the exact DDL of kpi_values, replace this block with that.
    op.create_table(
        "kpi_values",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("kpi_id", sa.String(), nullable=False),
        sa.Column("project_id", sa.String(), nullable=False),
        sa.Column("value", sa.Float(), nullable=False),
        sa.Column("recorded_at", sa.DateTime(), nullable=False),
        # add FKs back if you had them originally, e.g.:
        # sa.ForeignKeyConstraint(["kpi_id"], ["kpis.id"], name="fk_kpi_values_kpi_id"),
    )