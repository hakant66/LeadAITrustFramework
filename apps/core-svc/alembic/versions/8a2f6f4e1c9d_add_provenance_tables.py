"""add provenance tables

Revision ID: 8a2f6f4e1c9d
Revises: 7c3b0e9d1b2f
Create Date: 2026-01-26 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "8a2f6f4e1c9d"
down_revision: Union[str, Sequence[str], None] = "7c3b0e9d1b2f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "provenance_artifacts",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("project_slug", sa.String(length=120), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("uri", sa.Text(), nullable=False),
        sa.Column("sha256", sa.CHAR(64), nullable=False),
        sa.Column("size_bytes", sa.BigInteger, nullable=True),
        sa.Column("mime", sa.String(length=120), nullable=True),
        sa.Column("license_name", sa.String(length=200), nullable=True),
        sa.Column("license_url", sa.Text(), nullable=True),
        sa.Column("usage_rights", sa.Text(), nullable=True),
        sa.Column("created_by", sa.String(length=120), nullable=True),
        sa.Column(
            "created_at",
            postgresql.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint(
            "sha256 ~* '^[0-9a-f]{64}$'",
            name="ck_provenance_artifacts_sha256",
        ),
    )
    op.create_index(
        "ix_provenance_artifacts_project",
        "provenance_artifacts",
        ["project_slug"],
        unique=False,
    )
    op.create_index(
        "ix_provenance_artifacts_sha256",
        "provenance_artifacts",
        ["sha256"],
        unique=False,
    )

    op.create_table(
        "provenance_datasets",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("project_slug", sa.String(length=120), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("artifact_id", sa.String(), nullable=True),
        sa.Column("created_by", sa.String(length=120), nullable=True),
        sa.Column(
            "created_at",
            postgresql.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["artifact_id"],
            ["provenance_artifacts.id"],
            ondelete="SET NULL",
        ),
    )
    op.create_index(
        "ix_provenance_datasets_project",
        "provenance_datasets",
        ["project_slug"],
        unique=False,
    )

    op.create_table(
        "provenance_models",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("project_slug", sa.String(length=120), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("version", sa.String(length=120), nullable=True),
        sa.Column("framework", sa.String(length=120), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("artifact_id", sa.String(), nullable=True),
        sa.Column("created_by", sa.String(length=120), nullable=True),
        sa.Column(
            "created_at",
            postgresql.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["artifact_id"],
            ["provenance_artifacts.id"],
            ondelete="SET NULL",
        ),
    )
    op.create_index(
        "ix_provenance_models_project",
        "provenance_models",
        ["project_slug"],
        unique=False,
    )

    op.create_table(
        "provenance_evidence",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("project_slug", sa.String(length=120), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("artifact_id", sa.String(), nullable=True),
        sa.Column("created_by", sa.String(length=120), nullable=True),
        sa.Column(
            "created_at",
            postgresql.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["artifact_id"],
            ["provenance_artifacts.id"],
            ondelete="SET NULL",
        ),
    )
    op.create_index(
        "ix_provenance_evidence_project",
        "provenance_evidence",
        ["project_slug"],
        unique=False,
    )

    op.create_table(
        "provenance_lineage",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("project_slug", sa.String(length=120), nullable=False),
        sa.Column("parent_type", sa.String(length=40), nullable=False),
        sa.Column("parent_id", sa.String(), nullable=False),
        sa.Column("child_type", sa.String(length=40), nullable=False),
        sa.Column("child_id", sa.String(), nullable=False),
        sa.Column("relationship", sa.String(length=120), nullable=True),
        sa.Column(
            "created_at",
            postgresql.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint(
            "parent_type IN ('dataset','model','artifact','evidence')",
            name="ck_prov_lineage_parent_type",
        ),
        sa.CheckConstraint(
            "child_type IN ('dataset','model','artifact','evidence')",
            name="ck_prov_lineage_child_type",
        ),
    )
    op.create_index(
        "ix_provenance_lineage_project",
        "provenance_lineage",
        ["project_slug"],
        unique=False,
    )
    op.create_index(
        "ix_provenance_lineage_parent",
        "provenance_lineage",
        ["parent_type", "parent_id"],
        unique=False,
    )
    op.create_index(
        "ix_provenance_lineage_child",
        "provenance_lineage",
        ["child_type", "child_id"],
        unique=False,
    )

    op.create_table(
        "provenance_audit",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("entity_type", sa.String(length=40), nullable=False),
        sa.Column("entity_id", sa.String(), nullable=False),
        sa.Column("action", sa.String(length=120), nullable=False),
        sa.Column("actor", sa.String(length=120), nullable=True),
        sa.Column(
            "at",
            postgresql.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("details_json", postgresql.JSONB, nullable=True),
    )
    op.create_index(
        "ix_provenance_audit_entity",
        "provenance_audit",
        ["entity_type", "entity_id", "at"],
        unique=False,
    )

    op.execute(
        """
        CREATE OR REPLACE FUNCTION provenance_artifacts_immutable()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        BEGIN
          RAISE EXCEPTION 'provenance_artifacts are immutable';
        END;
        $$;
        """
    )
    op.execute(
        """
        CREATE TRIGGER trg_provenance_artifacts_immutable
        BEFORE UPDATE OR DELETE ON provenance_artifacts
        FOR EACH ROW EXECUTE FUNCTION provenance_artifacts_immutable();
        """
    )


def downgrade() -> None:
    op.execute(
        "DROP TRIGGER IF EXISTS trg_provenance_artifacts_immutable ON provenance_artifacts;"
    )
    op.execute("DROP FUNCTION IF EXISTS provenance_artifacts_immutable;")

    op.drop_index("ix_provenance_audit_entity", table_name="provenance_audit")
    op.drop_table("provenance_audit")

    op.drop_index("ix_provenance_lineage_child", table_name="provenance_lineage")
    op.drop_index("ix_provenance_lineage_parent", table_name="provenance_lineage")
    op.drop_index("ix_provenance_lineage_project", table_name="provenance_lineage")
    op.drop_table("provenance_lineage")

    op.drop_index("ix_provenance_evidence_project", table_name="provenance_evidence")
    op.drop_table("provenance_evidence")

    op.drop_index("ix_provenance_models_project", table_name="provenance_models")
    op.drop_table("provenance_models")

    op.drop_index("ix_provenance_datasets_project", table_name="provenance_datasets")
    op.drop_table("provenance_datasets")

    op.drop_index("ix_provenance_artifacts_sha256", table_name="provenance_artifacts")
    op.drop_index("ix_provenance_artifacts_project", table_name="provenance_artifacts")
    op.drop_table("provenance_artifacts")
