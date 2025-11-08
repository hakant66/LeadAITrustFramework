from alembic.config import Config
from alembic.script import ScriptDirectory
from alembic.runtime.environment import EnvironmentContext
from alembic.runtime.migration import MigrationContext
import sqlalchemy as sa

def check_state():
    # Check alembic revisions
    config = Config('alembic.ini')
    config.set_main_option('script_location', 'alembic')
    script = ScriptDirectory.from_config(config)
    
    print("=== Available Revisions ===")
    for rev in script.get_revisions():
        print(f"{rev.revision}: {rev.doc}")
    
    print("\n=== Current Database State ===")
    engine = sa.create_engine('your_database_connection_string_here')
    with engine.connect() as conn:
        # Check alembic version
        result = conn.execute(sa.text("SELECT version_num FROM alembic_version"))
        current_rev = result.scalar()
        print(f"Current database revision: {current_rev}")
        
        # Check table structure
        inspector = sa.inspect(engine)
        
        print("\n=== Controls Table ===")
        if inspector.has_table('controls'):
            columns = inspector.get_columns('controls')
            for col in columns:
                print(f"  {col['name']}: {col['type']} (nullable: {col['nullable']})")
            
            pk = inspector.get_pk_constraint('controls')
            print(f"  Primary Key: {pk}")
            
            fks = inspector.get_foreign_keys('controls')
            for fk in fks:
                print(f"  Foreign Key: {fk}")
        
        print("\n=== Control_Values Table ===")
        if inspector.has_table('control_values'):
            columns = inspector.get_columns('control_values')
            for col in columns:
                print(f"  {col['name']}: {col['type']} (nullable: {col['nullable']})")
            
            pk = inspector.get_pk_constraint('control_values')
            print(f"  Primary Key: {pk}")
            
            fks = inspector.get_foreign_keys('control_values')
            for fk in fks:
                print(f"  Foreign Key: {fk}")

if __name__ == '__main__':
    check_state()