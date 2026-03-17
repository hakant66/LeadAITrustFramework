"""backfill entity policy register fields for blueprint

Revision ID: 20260220_backfill_entity_policy_register_fields_for_blueprint
Revises: 37e28a23096b
Create Date: 2026-02-20 18:20:00.000000

"""
from __future__ import annotations

from alembic import op


# revision identifiers, used by Alembic.
revision = "20260220_backfill_entity_policy_register_fields_for_blueprint"
down_revision = "20260220_drop_policy_entity_columns"
branch_labels = None
depends_on = None

TARGET_ENTITY_ID = "acfd8ccd-29d3-4109-990f-6d71ce8c588e"
SOURCE_ENTITY_ID = "7c195697-0d47-4a08-be48-59e5b5a6d175"


def upgrade() -> None:
    op.execute(
        f"""
        UPDATE entity_policy_register AS t
        SET iso42001_requirements = COALESCE(NULLIF(t.iso42001_requirements, ''), s.iso42001_requirements),
            iso42001_status = COALESCE(NULLIF(t.iso42001_status, ''), s.iso42001_status),
            comment = COALESCE(NULLIF(t.comment, ''), s.comment),
            action = COALESCE(NULLIF(t.action, ''), s.action)
        FROM entity_policy_register AS s
        WHERE t.entity_id = '{TARGET_ENTITY_ID}'
          AND s.entity_id = '{SOURCE_ENTITY_ID}'
          AND t.policy_title = s.policy_title
          AND (
            t.iso42001_requirements IS NULL OR t.iso42001_requirements = ''
            OR t.iso42001_status IS NULL OR t.iso42001_status = ''
            OR t.comment IS NULL OR t.comment = ''
            OR t.action IS NULL OR t.action = ''
          );
        """
    )


def downgrade() -> None:
    op.execute(
        f"""
        UPDATE entity_policy_register AS t
        SET iso42001_requirements = NULL,
            iso42001_status = NULL,
            comment = NULL,
            action = NULL
        FROM entity_policy_register AS s
        WHERE t.entity_id = '{TARGET_ENTITY_ID}'
          AND s.entity_id = '{SOURCE_ENTITY_ID}'
          AND t.policy_title = s.policy_title
          AND t.iso42001_requirements = s.iso42001_requirements
          AND t.iso42001_status = s.iso42001_status
          AND t.comment = s.comment
          AND t.action = s.action;
        """
    )
