"""Add Jira integration tables for governance evidence sync

Revision ID: jira_integration_v1
Revises: e1f3a2b4c5d6
Create Date: 2026-02-11 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'jira_integration_v1'
down_revision = 'e1f3a2b4c5d6'
branch_labels = None
depends_on = None


def upgrade():
    # Table to store Jira sync metadata for traceability
    op.create_table(
        'jira_sync_metadata',
        sa.Column('id', sa.Text(), primary_key=True),
        sa.Column('project_slug', sa.Text(), nullable=False),
        sa.Column('jira_key', sa.Text(), nullable=False),
        sa.Column('jira_id', sa.Text(), nullable=False),
        sa.Column('governance_type', sa.Text(), nullable=False),  # governance.requirement, governance.risk, etc.
        sa.Column('issue_type', sa.Text(), nullable=True),  # Risk, Requirement, Control, etc.
        sa.Column('status', sa.Text(), nullable=False),
        sa.Column('last_synced_at', postgresql.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('sync_count', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('raw_data', postgresql.JSONB(), nullable=True),  # Full Jira issue JSON for audit
        sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('now()')),
    )
    op.create_index('ix_jira_sync_metadata_project', 'jira_sync_metadata', ['project_slug'])
    op.create_index('ix_jira_sync_metadata_jira_key', 'jira_sync_metadata', ['jira_key'], unique=True)
    op.create_index('ix_jira_sync_metadata_governance_type', 'jira_sync_metadata', ['governance_type'])
    
    # Table to store Jira risk register entries
    op.create_table(
        'jira_risk_register',
        sa.Column('id', sa.Text(), primary_key=True),
        sa.Column('project_slug', sa.Text(), nullable=False),
        sa.Column('jira_key', sa.Text(), nullable=False, unique=True),
        sa.Column('jira_id', sa.Text(), nullable=False),
        sa.Column('title', sa.Text(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('risk_level', sa.Text(), nullable=True),  # High, Medium, Low
        sa.Column('severity', sa.Text(), nullable=True),
        sa.Column('status', sa.Text(), nullable=False),
        sa.Column('owner', sa.Text(), nullable=True),
        sa.Column('due_date', postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('mitigations', postgresql.ARRAY(sa.Text()), nullable=True),  # Array of Jira keys
        sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('now()')),
    )
    op.create_index('ix_jira_risk_register_project', 'jira_risk_register', ['project_slug'])
    op.create_index('ix_jira_risk_register_jira_key', 'jira_risk_register', ['jira_key'], unique=True)
    
    # Add jira_source columns to evidence table if it doesn't exist
    # Check if column exists first (Alembic doesn't have native IF NOT EXISTS for columns)
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('evidence')]
    
    if 'jira_key' not in columns:
        op.add_column('evidence', sa.Column('jira_key', sa.Text(), nullable=True))
        op.add_column('evidence', sa.Column('jira_attachment_id', sa.Text(), nullable=True))
        op.create_index('ix_evidence_jira_key', 'evidence', ['jira_key'])


def downgrade():
    op.drop_index('ix_evidence_jira_key', table_name='evidence')
    op.drop_column('evidence', 'jira_attachment_id')
    op.drop_column('evidence', 'jira_key')
    
    op.drop_index('ix_jira_risk_register_jira_key', table_name='jira_risk_register')
    op.drop_index('ix_jira_risk_register_project', table_name='jira_risk_register')
    op.drop_table('jira_risk_register')
    
    op.drop_index('ix_jira_sync_metadata_governance_type', table_name='jira_sync_metadata')
    op.drop_index('ix_jira_sync_metadata_jira_key', table_name='jira_sync_metadata')
    op.drop_index('ix_jira_sync_metadata_project', table_name='jira_sync_metadata')
    op.drop_table('jira_sync_metadata')
