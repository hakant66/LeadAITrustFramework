"""Add report_type to llm_report_cache

Revision ID: 20260227_add_llm_report_cache_report_type
Revises: 20260226_control_reminder_log
Create Date: 2026-02-27
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20260227_add_llm_report_cache_report_type"
down_revision = "20260226_control_reminder_log"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()
    if "llm_report_cache" not in tables:
        return

    columns = [col["name"] for col in inspector.get_columns("llm_report_cache")]
    if "report_type" not in columns:
        op.add_column(
            "llm_report_cache",
            sa.Column(
                "report_type",
                sa.Text(),
                nullable=True,
                server_default="ai_summary_llm",
            ),
        )
    op.execute(
        "UPDATE llm_report_cache SET report_type = 'ai_summary_llm' WHERE report_type IS NULL"
    )
    # Keep column nullable to avoid migration failures in legacy environments.

    # Update unique constraint to include report_type (idempotent)
    op.execute(
        """
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'llm_report_cache_pkey'
          ) THEN
            ALTER TABLE llm_report_cache DROP CONSTRAINT llm_report_cache_pkey;
          END IF;
        END$$;
        """
    )
    op.execute("DROP INDEX IF EXISTS ix_llm_report_cache_project_slug")
    op.execute(
        """
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'uq_llm_report_cache_entity_project_provider'
          ) THEN
            ALTER TABLE llm_report_cache
              DROP CONSTRAINT uq_llm_report_cache_entity_project_provider;
          END IF;
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'uq_llm_report_cache_entity_project_provider_type'
          ) THEN
            ALTER TABLE llm_report_cache
              ADD CONSTRAINT uq_llm_report_cache_entity_project_provider_type
              UNIQUE (entity_id, project_slug, provider, report_type);
          END IF;
        END$$;
        """
    )

    # Replace composite index to include report_type
    op.execute(
        "DROP INDEX IF EXISTS ix_llm_report_cache_entity_project"
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_llm_report_cache_entity_project_type
        ON llm_report_cache (entity_id, project_slug, provider, report_type)
        """
    )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()
    if "llm_report_cache" not in tables:
        return

    op.execute(
        "DROP INDEX IF EXISTS ix_llm_report_cache_entity_project_type"
    )
    op.execute(
        """
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'uq_llm_report_cache_entity_project_provider_type'
          ) THEN
            ALTER TABLE llm_report_cache
              DROP CONSTRAINT uq_llm_report_cache_entity_project_provider_type;
          END IF;
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'uq_llm_report_cache_entity_project_provider'
          ) THEN
            ALTER TABLE llm_report_cache
              ADD CONSTRAINT uq_llm_report_cache_entity_project_provider
              UNIQUE (entity_id, project_slug, provider);
          END IF;
        END$$;
        """
    )
    op.execute(
        """
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'llm_report_cache_pkey'
          ) THEN
            ALTER TABLE llm_report_cache ADD CONSTRAINT llm_report_cache_pkey PRIMARY KEY (project_slug);
          END IF;
        END$$;
        """
    )
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS ix_llm_report_cache_project_slug
        ON llm_report_cache (project_slug)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_llm_report_cache_entity_project
        ON llm_report_cache (entity_id, project_slug, provider)
        """
    )

    columns = [col["name"] for col in inspector.get_columns("llm_report_cache")]
    if "report_type" in columns:
        op.drop_column("llm_report_cache", "report_type")
