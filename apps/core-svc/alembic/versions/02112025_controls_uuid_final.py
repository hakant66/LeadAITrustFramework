"""controls uuid and kpi key final

Revision ID: 02112025_controls_uuid_final
Revises: 20251018_add_project_fields
Create Date: 2025-02-11 16:35:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '02112025_controls_uuid_final'
down_revision = '20251018_add_project_fields'
branch_labels = None
depends_on = None


def upgrade():
    # Step 1: Add new id column to controls table
    op.add_column('controls', 
        sa.Column('id', postgresql.UUID(), 
                 server_default=sa.text('gen_random_uuid()'), 
                 nullable=False))
    
    # Step 2: Add temporary column to control_values
    op.add_column('control_values', 
        sa.Column('new_control_id', postgresql.UUID(), nullable=True))
    
    # Step 3: Data migration - populate new control_id in control_values
    connection = op.get_bind()
    connection.execute(sa.text("""
        UPDATE control_values 
        SET new_control_id = controls.id
        FROM controls 
        WHERE control_values.control_id = controls.control_id
    """))
    
    # Step 4: Drop the foreign key constraint first (this depends on the primary key)
    op.drop_constraint('control_values_control_id_fkey', 'control_values', type_='foreignkey')
    
    # Step 5: Drop the old primary key from controls
    op.drop_constraint('controls_pkey', 'controls', type_='primary')
    
    # Step 6: Create new primary key on the id column
    op.create_primary_key('controls_pkey', 'controls', ['id'])
    
    # Step 7: Rename columns in controls table
    op.alter_column('controls', 'control_id',
                    new_column_name='kpi_key',
                    existing_type=sa.TEXT(),
                    existing_nullable=False)
    
    # Step 8: Rename columns in control_values table  
    op.alter_column('control_values', 'control_id',
                    new_column_name='kpi_key',
                    existing_type=sa.TEXT(),
                    existing_nullable=False)
    
    op.alter_column('control_values', 'new_control_id',
                    new_column_name='control_id',
                    existing_type=postgresql.UUID(),
                    existing_nullable=True)
    
    # Step 9: Make control_id NOT NULL in control_values
    op.alter_column('control_values', 'control_id',
                    nullable=False)
    
    # Step 10: Drop old primary key and create new one on control_values
    op.drop_constraint('control_values_pkey', 'control_values', type_='primary')
    op.create_primary_key('control_values_pkey', 'control_values', 
                         ['project_slug', 'control_id'])
    
    # Step 11: Recreate foreign key constraint with the new id column
    op.create_foreign_key('control_values_control_id_fkey', 'control_values', 
                         'controls', ['control_id'], ['id'], 
                         ondelete='CASCADE')


def downgrade():
    # Step 1: Revert foreign key
    op.drop_constraint('control_values_control_id_fkey', 'control_values', 
                      type_='foreignkey')
    
    # Step 2: Revert primary key in control_values
    op.drop_constraint('control_values_pkey', 'control_values', type_='primary')
    op.create_primary_key('control_values_pkey', 'control_values', 
                         ['project_slug', 'kpi_key'])
    
    # Step 3: Rename columns back in control_values
    op.alter_column('control_values', 'control_id',
                    new_column_name='new_control_id',
                    existing_type=postgresql.UUID(),
                    existing_nullable=False)
    
    op.alter_column('control_values', 'kpi_key',
                    new_column_name='control_id',
                    existing_type=sa.TEXT(),
                    existing_nullable=False)
    
    # Step 4: Drop the temporary column
    op.drop_column('control_values', 'new_control_id')
    
    # Step 5: Rename kpi_key back to control_id in controls
    op.alter_column('controls', 'kpi_key',
                    new_column_name='control_id',
                    existing_type=sa.TEXT(),
                    existing_nullable=False)
    
    # Step 6: Drop the new primary key and revert to old one in controls
    op.drop_constraint('controls_pkey', 'controls', type_='primary')
    op.create_primary_key('controls_pkey', 'controls', ['control_id'])
    
    # Step 7: Drop the id column from controls
    op.drop_column('controls', 'id')
    
    # Step 8: Recreate original foreign key
    op.create_foreign_key('control_values_control_id_fkey', 'control_values', 
                         'controls', ['control_id'], ['control_id'], 
                         ondelete='CASCADE')