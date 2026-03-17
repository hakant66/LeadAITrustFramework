"""Update composite unique constraints for multi-entity

Revision ID: update_composite_unique_constraints_v1
Revises: set_entity_id_not_null_v1
Create Date: 2026-02-13

Drop old global unique constraints and add composite unique constraints
that include entity_id for proper multi-entity isolation.
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "update_composite_unique_constraints_v1"
down_revision = "set_entity_id_not_null_v1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()
    
    # Helper function to check for duplicate values before adding constraint
    def check_duplicates(table_name: str, columns: list[str]) -> None:
        """Raise error if duplicates exist for the given columns."""
        cols_str = ", ".join(columns)
        result = conn.execute(sa.text(f"""
            SELECT {cols_str}, COUNT(*) as count
            FROM {table_name}
            GROUP BY {cols_str}
            HAVING COUNT(*) > 1
        """))
        duplicates = result.fetchall()
        if duplicates:
            raise ValueError(
                f"Cannot add composite unique constraint on {table_name}({cols_str}): "
                f"Found {len(duplicates)} duplicate combinations. "
                f"First duplicate: {duplicates[0]}"
            )
    
    # Helper function to drop index/constraint if it exists
    def drop_index_if_exists(index_name: str, table_name: str) -> None:
        """Drop index if it exists."""
        indexes = [idx["name"] for idx in inspector.get_indexes(table_name)]
        if index_name in indexes:
            op.drop_index(index_name, table_name=table_name)
    
    # Helper function to drop constraint if it exists
    def drop_constraint_if_exists(constraint_name: str, table_name: str) -> None:
        """Drop constraint if it exists."""
        constraints = [c["name"] for c in inspector.get_unique_constraints(table_name)]
        if constraint_name in constraints:
            op.drop_constraint(constraint_name, table_name=table_name, type_="unique")
    
    # 1. entity_projects: Drop global unique on slug, add (entity_id, slug) composite unique
    if "entity_projects" in tables:
        # Check for duplicates first
        check_duplicates("entity_projects", ["entity_id", "slug"])
        
        # Drop old unique indexes/constraints on slug
        drop_index_if_exists("ix_entity_projects_slug", "entity_projects")
        drop_index_if_exists("ix_projects_slug", "entity_projects")
        drop_index_if_exists("projects_slug_key", "entity_projects")
        
        # Add composite unique constraint
        op.create_unique_constraint(
            "uq_entity_projects_entity_slug",
            "entity_projects",
            ["entity_id", "slug"]
        )
    
    # 2. llm_report_cache: Drop unique on project_slug, add (entity_id, project_slug, provider) composite unique
    if "llm_report_cache" in tables:
        columns = [col["name"] for col in inspector.get_columns("llm_report_cache")]
        if "entity_id" in columns and "project_slug" in columns and "provider" in columns:
            check_duplicates("llm_report_cache", ["entity_id", "project_slug", "provider"])
            
            # Drop old unique index on project_slug
            drop_index_if_exists("ix_llm_report_cache_project_slug", "llm_report_cache")
            
            # Add composite unique constraint
            op.create_unique_constraint(
                "uq_llm_report_cache_entity_project_provider",
                "llm_report_cache",
                ["entity_id", "project_slug", "provider"]
            )
    
    # 3. project_pillar_scores: Change PK from (project_id, pillar_key) to (entity_id, project_id, pillar_key)
    if "project_pillar_scores" in tables:
        columns = [col["name"] for col in inspector.get_columns("project_pillar_scores")]
        if "entity_id" in columns:
            check_duplicates("project_pillar_scores", ["entity_id", "project_id", "pillar_key"])
            
            # Drop old primary key
            op.drop_constraint("project_pillar_scores_pkey", "project_pillar_scores", type_="primary")
            
            # Add new composite primary key
            op.create_primary_key(
                "project_pillar_scores_pkey",
                "project_pillar_scores",
                ["entity_id", "project_id", "pillar_key"]
            )
    
    # 4. pillar_overrides: Update unique from (project_id, pillar_key) to (entity_id, project_id, pillar_key)
    if "pillar_overrides" in tables:
        columns = [col["name"] for col in inspector.get_columns("pillar_overrides")]
        if "entity_id" in columns:
            check_duplicates("pillar_overrides", ["entity_id", "project_id", "pillar_key"])
            
            # Drop old unique constraint
            drop_constraint_if_exists("uq_pillar_overrides_project_pillar", "pillar_overrides")
            
            # Add new composite unique constraint
            op.create_unique_constraint(
                "uq_pillar_overrides_entity_project_pillar",
                "pillar_overrides",
                ["entity_id", "project_id", "pillar_key"]
            )
    
    # 5. policies: Add (entity_id, title) composite unique constraint
    if "policies" in tables:
        columns = [col["name"] for col in inspector.get_columns("policies")]
        if "entity_id" in columns and "title" in columns:
            check_duplicates("policies", ["entity_id", "title"])
            
            # Drop old non-unique index if it exists (it's not unique, but we'll replace it)
            drop_index_if_exists("ix_policies_title", "policies")
            
            # Add composite unique constraint
            op.create_unique_constraint(
                "uq_policies_entity_title",
                "policies",
                ["entity_id", "title"]
            )
            
            # Recreate index for performance (non-unique)
            op.create_index(
                "ix_policies_title",
                "policies",
                ["title"],
                unique=False
            )
    
    # 6. aims_scope: Add (entity_id, scope_name) composite unique constraint if scope_name should be unique
    # Note: scope_name is nullable, so we only enforce uniqueness on non-null values
    if "aims_scope" in tables:
        columns = [col["name"] for col in inspector.get_columns("aims_scope")]
        if "entity_id" in columns and "scope_name" in columns:
            # Check for duplicates only where scope_name is NOT NULL
            result = conn.execute(sa.text("""
                SELECT entity_id, scope_name, COUNT(*) as count
                FROM aims_scope
                WHERE scope_name IS NOT NULL
                GROUP BY entity_id, scope_name
                HAVING COUNT(*) > 1
            """))
            duplicates = result.fetchall()
            if duplicates:
                raise ValueError(
                    f"Cannot add composite unique constraint on aims_scope(entity_id, scope_name): "
                    f"Found {len(duplicates)} duplicate combinations. "
                    f"First duplicate: {duplicates[0]}"
                )
            
            # Add composite unique constraint (PostgreSQL allows NULLs in unique constraints)
            op.create_unique_constraint(
                "uq_aims_scope_entity_scope_name",
                "aims_scope",
                ["entity_id", "scope_name"]
            )


def downgrade() -> None:
    # Revert composite unique constraints back to global uniques
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()
    
    def drop_constraint_if_exists(constraint_name: str, table_name: str) -> None:
        """Drop constraint if it exists."""
        constraints = [c["name"] for c in inspector.get_unique_constraints(table_name)]
        if constraint_name in constraints:
            op.drop_constraint(constraint_name, table_name=table_name, type_="unique")
    
    # 1. entity_projects: Drop composite unique, restore global unique on slug
    if "entity_projects" in tables:
        drop_constraint_if_exists("uq_entity_projects_entity_slug", "entity_projects")
        # Restore global unique index on slug
        op.create_index(
            "ix_entity_projects_slug",
            "entity_projects",
            ["slug"],
            unique=True
        )
    
    # 2. llm_report_cache: Drop composite unique, restore global unique on project_slug
    if "llm_report_cache" in tables:
        drop_constraint_if_exists("uq_llm_report_cache_entity_project_provider", "llm_report_cache")
        columns = [col["name"] for col in inspector.get_columns("llm_report_cache")]
        if "project_slug" in columns:
            op.create_index(
                "ix_llm_report_cache_project_slug",
                "llm_report_cache",
                ["project_slug"],
                unique=True
            )
    
    # 3. project_pillar_scores: Restore PK to (project_id, pillar_key)
    if "project_pillar_scores" in tables:
        op.drop_constraint("project_pillar_scores_pkey", "project_pillar_scores", type_="primary")
        op.create_primary_key(
            "project_pillar_scores_pkey",
            "project_pillar_scores",
            ["project_id", "pillar_key"]
        )
    
    # 4. pillar_overrides: Restore unique to (project_id, pillar_key)
    if "pillar_overrides" in tables:
        drop_constraint_if_exists("uq_pillar_overrides_entity_project_pillar", "pillar_overrides")
        op.create_unique_constraint(
            "uq_pillar_overrides_project_pillar",
            "pillar_overrides",
            ["project_id", "pillar_key"]
        )
    
    # 5. policies: Drop composite unique, restore non-unique index
    if "policies" in tables:
        drop_constraint_if_exists("uq_policies_entity_title", "policies")
        columns = [col["name"] for col in inspector.get_columns("policies")]
        if "title" in columns:
            op.create_index(
                "ix_policies_title",
                "policies",
                ["title"],
                unique=False
            )
    
    # 6. aims_scope: Drop composite unique
    if "aims_scope" in tables:
        drop_constraint_if_exists("uq_aims_scope_entity_scope_name", "aims_scope")
