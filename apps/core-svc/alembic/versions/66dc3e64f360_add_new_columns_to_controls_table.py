"""add new columns to controls table

Revision ID: 66dc3e64f360
Revises: 02112025_controls_uuid_final
Create Date: 2025-11-02 18:37:29.619259

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '66dc3e64f360'
down_revision: Union[str, Sequence[str], None] = '02112025_controls_uuid_final'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    # Add all new columns to controls table
    op.add_column('controls', 
        sa.Column('target_text', sa.Text(), nullable=True))
    
    op.add_column('controls', 
        sa.Column('target_numeric', sa.Integer(), nullable=True))
    
    op.add_column('controls', 
        sa.Column('evidence_source', sa.Text(), nullable=True))
    
    op.add_column('controls', 
        sa.Column('owner_role', sa.Text(), nullable=True))
    
    op.add_column('controls', 
        sa.Column('frequency', sa.Integer(), nullable=True))
    
    op.add_column('controls', 
        sa.Column('failure_action', sa.Integer(), nullable=True))
    
    op.add_column('controls', 
        sa.Column('maturity_anchor_L3', sa.Integer(), nullable=True))
    
    op.add_column('controls', 
        sa.Column('current_value', sa.Integer(), nullable=True))
    
    op.add_column('controls', 
        sa.Column('as_of', sa.Integer(), nullable=True))
    
    op.add_column('controls', 
        sa.Column('notes', sa.Text(), nullable=True))
    
    op.add_column('controls', 
        sa.Column('kpi_score', sa.Integer(), nullable=True))
    
    op.add_column('controls', 
        sa.Column('description', sa.Text(), nullable=True))
    
    op.add_column('controls', 
        sa.Column('example', sa.Text(), nullable=True))


def downgrade():
    # Remove all added columns
    op.drop_column('controls', 'example')
    op.drop_column('controls', 'description')
    op.drop_column('controls', 'kpi_score')
    op.drop_column('controls', 'notes')
    op.drop_column('controls', 'as_of')
    op.drop_column('controls', 'current_value')
    op.drop_column('controls', 'maturity_anchor_L3')
    op.drop_column('controls', 'failure_action')
    op.drop_column('controls', 'frequency')
    op.drop_column('controls', 'owner_role')
    op.drop_column('controls', 'evidence_source')
    op.drop_column('controls', 'target_numeric')
    op.drop_column('controls', 'target_text')
