# apps/core-svc/alembic/versions/20260131_add_ai_registry_and_requirements.py
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# --- Alembic identifiers ---
revision = "e1f3a2b4c5d6"
down_revision = "d2a4f0c9e8b1"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "ai_system_registry",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("uc_id", sa.Text(), nullable=False),
        sa.Column("project_slug", sa.Text(), nullable=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("owner", sa.Text(), nullable=True),
        sa.Column("business_unit", sa.Text(), nullable=True),
        sa.Column("vendor", sa.Text(), nullable=True),
        sa.Column("provider_type", sa.Text(), nullable=True),
        sa.Column("risk_tier", sa.Text(), nullable=True),
        sa.Column("status", sa.Text(), nullable=False, server_default=sa.text("'active'")),
        sa.Column("region_scope", sa.Text(), nullable=True),
        sa.Column("data_sensitivity", sa.Text(), nullable=True),
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
    op.create_index("ix_ai_system_registry_uc_id", "ai_system_registry", ["uc_id"], unique=True)
    op.create_index(
        "ix_ai_system_registry_project", "ai_system_registry", ["project_slug"], unique=False
    )

    op.create_table(
        "ai_requirement_register",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("project_slug", sa.Text(), nullable=True),
        sa.Column("uc_id", sa.Text(), nullable=True),
        sa.Column("framework", sa.Text(), nullable=False),
        sa.Column("requirement_code", sa.Text(), nullable=False),
        sa.Column("title", sa.Text(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("applicability", sa.Text(), nullable=True),
        sa.Column("owner_role", sa.Text(), nullable=True),
        sa.Column("status", sa.Text(), nullable=False, server_default=sa.text("'not_started'")),
        sa.Column("evidence_ids", postgresql.JSONB, nullable=True),
        sa.Column("mapped_controls", postgresql.JSONB, nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
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
    op.create_index(
        "ix_ai_requirement_register_project",
        "ai_requirement_register",
        ["project_slug"],
        unique=False,
    )
    op.create_index(
        "ix_ai_requirement_register_uc_id",
        "ai_requirement_register",
        ["uc_id"],
        unique=False,
    )
    op.create_index(
        "ix_ai_requirement_register_framework",
        "ai_requirement_register",
        ["framework"],
        unique=False,
    )
    op.create_index(
        "ix_ai_requirement_register_req_code",
        "ai_requirement_register",
        ["requirement_code"],
        unique=False,
    )


def downgrade():
    op.drop_index("ix_ai_requirement_register_req_code", table_name="ai_requirement_register")
    op.drop_index("ix_ai_requirement_register_framework", table_name="ai_requirement_register")
    op.drop_index("ix_ai_requirement_register_uc_id", table_name="ai_requirement_register")
    op.drop_index("ix_ai_requirement_register_project", table_name="ai_requirement_register")
    op.drop_table("ai_requirement_register")

    op.drop_index("ix_ai_system_registry_project", table_name="ai_system_registry")
    op.drop_index("ix_ai_system_registry_uc_id", table_name="ai_system_registry")
    op.drop_table("ai_system_registry")
