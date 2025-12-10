"""drop kpi_values and add kpi_definition_v2

Revision ID: 9294fe872fae
Revises: 93714713f947
Create Date: 2025-12-08 16:48:26.557192

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "9294fe872fae"
down_revision = "93714713f947"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1) Drop kpi_values table if it exists
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

        # Primary key & unique on key (new names to avoid collision with kpis)
        sa.PrimaryKeyConstraint("kpi_id", name="kpi_definition_pkey"),
        sa.UniqueConstraint("kpi_key", name="kpi_definition_kpi_key_unique"),

        # FK: pillar_id → pillars.id  (same as kpis)
        sa.ForeignKeyConstraint(
            ["pillar_id"],
            ["pillars.id"],
            name="fk_kpi_definition_pillar",
            ondelete="CASCADE",
        ),

        # Optional: FKs back to kpis to keep mapping
        # Remove these two if you plan to fully replace kpis.
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

    # Optional index on kpi_key (mirroring ix_kpis_key pattern)
    op.create_index(
        "ix_kpi_definition_kpi_key",
        "kpi_definition",
        ["kpi_key"],
        unique=True,
    )

    # 3) Copy data from kpis → kpi_definition
    # New column "definition" is set to NULL for now.
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
    op.drop_index("ix_kpi_definition_kpi_key", table_name="kpi_definition")
    op.drop_table("kpi_definition")

    # 2) Recreate kpi_values exactly as originally defined
    op.create_table(
        "kpi_values",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("assessment_id", sa.String(), nullable=False),
        sa.Column("kpi_id", sa.String(), nullable=False),
        sa.Column("raw_value", sa.Float(), nullable=False),
        sa.Column("normalized_0_100", sa.Float(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id", name="kpi_values_pkey"),
        sa.ForeignKeyConstraint(
            ["kpi_id"],
            ["kpis.id"],
            name="fk_kv_kpi",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["assessment_id"],
            ["assessments.id"],
            name="kpi_values_assessment_id_fkey",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["kpi_id"],
            ["kpis.id"],
            name="kpi_values_kpi_id_fkey",
            ondelete="CASCADE",
        ),
    )