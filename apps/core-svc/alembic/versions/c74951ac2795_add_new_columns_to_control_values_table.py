"""add new columns to control_values table

Revision ID: c74951ac2795
Revises: 66dc3e64f360
Create Date: 2025-02-11 17:10:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'c74951ac2795'
down_revision = '66dc3e64f360'
branch_labels = None
depends_on = None


def upgrade():
    # Add all new columns to control_values table only
    op.add_column('control_values', 
        sa.Column('target_text', sa.Text(), nullable=True))
    
    op.add_column('control_values', 
        sa.Column('target_numeric', sa.Integer(), nullable=True))
    
    op.add_column('control_values', 
        sa.Column('evidence_source', sa.Text(), nullable=True))
    
    op.add_column('control_values', 
        sa.Column('owner_role', sa.Text(), nullable=True))
    
    op.add_column('control_values', 
        sa.Column('frequency', sa.Integer(), nullable=True))
    
    op.add_column('control_values', 
        sa.Column('failure_action', sa.Integer(), nullable=True))
    
    op.add_column('control_values', 
        sa.Column('maturity_anchor_L3', sa.Integer(), nullable=True))
    
    op.add_column('control_values', 
        sa.Column('current_value', sa.Integer(), nullable=True))
    
    op.add_column('control_values', 
        sa.Column('as_of', sa.Integer(), nullable=True))
    
    op.add_column('control_values', 
        sa.Column('notes', sa.Text(), nullable=True))
    
    op.add_column('control_values', 
        sa.Column('kpi_score', sa.Integer(), nullable=True))


def downgrade():
    # Remove all added columns from control_values only
    op.drop_column('control_values', 'kpi_score')
    op.drop_column('control_values', 'notes')
    op.drop_column('control_values', 'as_of')
    op.drop_column('control_values', 'current_value')
    op.drop_column('control_values', 'maturity_anchor_L3')
    op.drop_column('control_values', 'failure_action')
    op.drop_column('control_values', 'frequency')
    op.drop_column('control_values', 'owner_role')
    op.drop_column('control_values', 'evidence_source')
    op.drop_column('control_values', 'target_numeric')
    op.drop_column('control_values', 'target_text')