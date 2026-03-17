# apps/core-svc/alembic/versions/20260131_add_aims_scope_and_policy_manager.py
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# --- Alembic identifiers ---
revision = "ab12cd34ef56"
down_revision = "f4a5b6c7d8e9"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "aims_scope",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("scope_name", sa.Text(), nullable=True),
        sa.Column("scope_statement", sa.Text(), nullable=True),
        sa.Column("context_internal", sa.Text(), nullable=True),
        sa.Column("context_external", sa.Text(), nullable=True),
        sa.Column("interested_parties", postgresql.JSONB, nullable=True),
        sa.Column("scope_boundaries", sa.Text(), nullable=True),
        sa.Column("lifecycle_coverage", postgresql.JSONB, nullable=True),
        sa.Column("cloud_platforms", postgresql.JSONB, nullable=True),
        sa.Column("regulatory_requirements", postgresql.JSONB, nullable=True),
        sa.Column("isms_pms_integration", sa.Text(), nullable=True),
        sa.Column("exclusions", sa.Text(), nullable=True),
        sa.Column("owner", sa.Text(), nullable=True),
        sa.Column("status", sa.Text(), nullable=False, server_default=sa.text("'draft'")),
        sa.Column("updated_by", sa.Text(), nullable=True),
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
    )

    op.create_table(
        "policies",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("owner_role", sa.Text(), nullable=True),
        sa.Column("status", sa.Text(), nullable=False, server_default=sa.text("'draft'")),
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
    )
    op.create_index("ix_policies_title", "policies", ["title"], unique=False)

    op.create_table(
        "policy_versions",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("policy_id", sa.Text(), nullable=False),
        sa.Column("version_label", sa.Text(), nullable=False),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("status", sa.Text(), nullable=False, server_default=sa.text("'draft'")),
        sa.Column("approved_by", sa.Text(), nullable=True),
        sa.Column("approved_at", postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            postgresql.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["policy_id"], ["policies.id"], ondelete="CASCADE"
        ),
    )
    op.create_index("ix_policy_versions_policy", "policy_versions", ["policy_id"], unique=False)


def downgrade():
    op.drop_index("ix_policy_versions_policy", table_name="policy_versions")
    op.drop_table("policy_versions")
    op.drop_index("ix_policies_title", table_name="policies")
    op.drop_table("policies")
    op.drop_table("aims_scope")
