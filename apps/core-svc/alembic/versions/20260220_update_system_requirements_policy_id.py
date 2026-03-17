"""update system requirements policy id structure

Revision ID: 20260220_update_system_requirements_policy_id
Revises: 20260220_policy_template_uuid
Create Date: 2026-02-20
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260220_update_system_requirements_policy_id"
down_revision = "37e28a23096b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Update existing 'system-requirements-policy' records to use new ID format:
    {entity_slug}-{project_slug}-system-requirements-policy
    
    For each project that has policy_alerts referencing the old policy,
    create a new policy with the entity-scoped ID and update the alerts.
    """
    conn = op.get_bind()
    
    # Find the old policy
    old_policy_result = conn.execute(
        sa.text("SELECT id, title, owner_role, status, created_at, updated_at FROM policies WHERE id = 'system-requirements-policy'")
    )
    old_policy = old_policy_result.fetchone()
    
    if not old_policy:
        # No old policy exists, nothing to migrate
        return
    
    # Extract policy data
    old_title = old_policy[1]
    old_owner_role = old_policy[2]
    old_status = old_policy[3]
    old_created_at = old_policy[4]
    old_updated_at = old_policy[5]
    
    # Find all projects that have alerts referencing the old policy
    projects_result = conn.execute(
        sa.text("""
            SELECT DISTINCT pa.project_slug, ep.entity_slug, ep.entity_id
            FROM policy_alerts pa
            JOIN entity_projects ep ON ep.slug = pa.project_slug
            WHERE pa.policy_id = 'system-requirements-policy'
              AND pa.project_slug IS NOT NULL
              AND pa.project_slug != 'global'
        """)
    )
    projects_with_alerts = projects_result.fetchall()
    
    # For each project, create a new policy with the new ID format
    for project_row in projects_with_alerts:
        project_slug = project_row[0]
        entity_slug = project_row[1]
        
        if not entity_slug or not project_slug:
            continue
            
        new_policy_id = f"{entity_slug}-{project_slug}-system-requirements-policy"
        
        # Check if new policy already exists
        existing_result = conn.execute(
            sa.text("SELECT id FROM policies WHERE id = :policy_id").bindparams(policy_id=new_policy_id)
        )
        existing = existing_result.fetchone()
        
        if not existing:
            # Create new policy with entity-scoped ID
            conn.execute(
                sa.text("""
                    INSERT INTO policies (id, title, owner_role, status, created_at, updated_at)
                    VALUES (:id, :title, :owner_role, :status, :created_at, :updated_at)
                """).bindparams(
                    id=new_policy_id,
                    title=old_title,
                    owner_role=old_owner_role,
                    status=old_status,
                    created_at=old_created_at,
                    updated_at=old_updated_at,
                )
            )
        
        # Update policy_alerts to reference the new policy ID
        conn.execute(
            sa.text("""
                UPDATE policy_alerts
                SET policy_id = :new_policy_id,
                    updated_at = NOW()
                WHERE policy_id = 'system-requirements-policy'
                  AND project_slug = :project_slug
            """).bindparams(
                new_policy_id=new_policy_id,
                project_slug=project_slug,
            )
        )
    
    # Handle global alerts (alerts without a specific project_slug)
    global_alerts_result = conn.execute(
        sa.text("""
            SELECT COUNT(*) FROM policy_alerts
            WHERE policy_id = 'system-requirements-policy'
              AND (project_slug IS NULL OR project_slug = 'global')
        """)
    )
    global_alerts = global_alerts_result.scalar()
    
    if global_alerts > 0:
        # For global alerts, we need to determine which entity to use
        # Use the first entity found
        first_entity_result = conn.execute(
            sa.text("SELECT slug FROM entity WHERE status = 'active' ORDER BY created_at LIMIT 1")
        )
        first_entity = first_entity_result.fetchone()
        
        if first_entity:
            entity_slug = first_entity[0]
            global_policy_id = f"{entity_slug}-global-system-requirements-policy"
            
            # Create global policy if it doesn't exist
            existing_global_result = conn.execute(
                sa.text("SELECT id FROM policies WHERE id = :policy_id").bindparams(policy_id=global_policy_id)
            )
            existing_global = existing_global_result.fetchone()
            
            if not existing_global:
                conn.execute(
                    sa.text("""
                        INSERT INTO policies (id, title, owner_role, status, created_at, updated_at)
                        VALUES (:id, :title, :owner_role, :status, :created_at, :updated_at)
                    """).bindparams(
                        id=global_policy_id,
                        title=old_title,
                        owner_role=old_owner_role,
                        status=old_status,
                        created_at=old_created_at,
                        updated_at=old_updated_at,
                    )
                )
            
            # Update global alerts
            conn.execute(
                sa.text("""
                    UPDATE policy_alerts
                    SET policy_id = :new_policy_id,
                        updated_at = NOW()
                    WHERE policy_id = 'system-requirements-policy'
                      AND (project_slug IS NULL OR project_slug = 'global')
                """).bindparams(new_policy_id=global_policy_id)
            )
    
    # Optionally delete the old policy if no alerts reference it anymore
    remaining_alerts_result = conn.execute(
        sa.text("SELECT COUNT(*) FROM policy_alerts WHERE policy_id = 'system-requirements-policy'")
    )
    remaining_alerts = remaining_alerts_result.scalar()
    
    if remaining_alerts == 0:
        # Delete the old policy (CASCADE will handle policy_versions if any)
        conn.execute(
            sa.text("DELETE FROM policies WHERE id = 'system-requirements-policy'")
        )


def downgrade() -> None:
    """
    Revert to the old single 'system-requirements-policy' ID.
    This consolidates all entity-scoped policies back into one.
    """
    conn = op.get_bind()
    
    # Find all policies with the new ID format
    new_policies_result = conn.execute(
        sa.text("""
            SELECT id, title, owner_role, status, created_at, updated_at
            FROM policies
            WHERE id LIKE '%-system-requirements-policy'
        """)
    )
    new_policies = new_policies_result.fetchall()
    
    if not new_policies:
        return
    
    # Use the first policy's data as the template for the consolidated policy
    first_policy = new_policies[0]
    
    # Create or update the old policy ID
    conn.execute(
        sa.text("""
            INSERT INTO policies (id, title, owner_role, status, created_at, updated_at)
            VALUES ('system-requirements-policy', :title, :owner_role, :status, :created_at, :updated_at)
            ON CONFLICT (id) DO UPDATE
            SET title = EXCLUDED.title,
                owner_role = EXCLUDED.owner_role,
                status = EXCLUDED.status,
                updated_at = NOW()
        """).bindparams(
            title=first_policy[1],
            owner_role=first_policy[2],
            status=first_policy[3],
            created_at=first_policy[4],
            updated_at=first_policy[5],
        )
    )
    
    # Update all policy_alerts to reference the old policy ID
    conn.execute(
        sa.text("""
            UPDATE policy_alerts
            SET policy_id = 'system-requirements-policy',
                updated_at = NOW()
            WHERE policy_id LIKE '%-system-requirements-policy'
        """)
    )
    
    # Delete the new entity-scoped policies
    conn.execute(
        sa.text("DELETE FROM policies WHERE id LIKE '%-system-requirements-policy'")
    )
