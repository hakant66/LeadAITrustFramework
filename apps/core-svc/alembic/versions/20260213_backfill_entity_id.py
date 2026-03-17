"""Backfill entity_id for all existing data

Revision ID: backfill_entity_id_v1
Revises: add_entity_id_foreign_keys_v1
Create Date: 2026-02-13

Creates a default entity and assigns all existing data to it.
This migration ensures no NULL entity_id values exist before setting NOT NULL constraints.
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "backfill_entity_id_v1"
down_revision = "add_entity_id_foreign_keys_v1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    
    # Step 1: Create default entity if it doesn't exist
    # Check if any entity exists
    result = conn.execute(sa.text("SELECT id FROM entity LIMIT 1"))
    default_entity_id = result.fetchone()
    
    if not default_entity_id:
        # Create default entity
        conn.execute(sa.text("""
            INSERT INTO entity (full_legal_name, slug, status)
            VALUES ('Default Entity', 'default-entity', 'active')
            RETURNING id
        """))
        result = conn.execute(sa.text("SELECT id FROM entity WHERE slug = 'default-entity'"))
        default_entity_id = result.fetchone()[0]
    else:
        default_entity_id = default_entity_id[0]
    
    # Step 2: Backfill entity_projects
    conn.execute(sa.text("""
        UPDATE entity_projects
        SET entity_id = :entity_id
        WHERE entity_id IS NULL
    """).bindparams(entity_id=default_entity_id))
    
    # Step 3: Backfill project-dependent tables via project relationship
    conn.execute(sa.text("""
        UPDATE assessments a
        SET entity_id = p.entity_id
        FROM entity_projects p
        WHERE a.project_id = p.id AND a.entity_id IS NULL
    """))
    
    conn.execute(sa.text("""
        UPDATE pillar_overrides po
        SET entity_id = p.entity_id
        FROM entity_projects p
        WHERE po.project_id = p.id AND po.entity_id IS NULL
    """))
    
    if "pillar_overrides_history" in inspector.get_table_names():
        conn.execute(sa.text("""
            UPDATE pillar_overrides_history poh
            SET entity_id = p.entity_id
            FROM entity_projects p
            WHERE poh.project_id = p.id AND poh.entity_id IS NULL
        """))
    
    conn.execute(sa.text("""
        UPDATE project_translations pt
        SET entity_id = p.entity_id
        FROM entity_projects p
        WHERE pt.project_id = p.id AND pt.entity_id IS NULL
    """))
    
    conn.execute(sa.text("""
        UPDATE project_pillar_scores pps
        SET entity_id = p.entity_id
        FROM entity_projects p
        WHERE pps.project_id = p.id AND pps.entity_id IS NULL
    """))
    
    # Step 4: Backfill control & evidence tables via project relationship
    conn.execute(sa.text("""
        UPDATE control_values cv
        SET entity_id = p.entity_id
        FROM entity_projects p
        WHERE cv.project_slug = p.slug AND cv.entity_id IS NULL
    """))
    
    conn.execute(sa.text("""
        UPDATE control_values_history cvh
        SET entity_id = p.entity_id
        FROM entity_projects p
        WHERE cvh.project_slug = p.slug AND cvh.entity_id IS NULL
    """))
    
    conn.execute(sa.text("""
        UPDATE evidence e
        SET entity_id = p.entity_id
        FROM entity_projects p
        WHERE e.project_slug = p.slug AND e.entity_id IS NULL
    """))
    
    conn.execute(sa.text("""
        UPDATE evidence_audit ea
        SET entity_id = e.entity_id
        FROM evidence e
        WHERE ea.evidence_id = e.id AND ea.entity_id IS NULL
    """))
    
    # Step 5: Backfill provenance tables via project relationship
    if "provenance_artifacts" in inspector.get_table_names():
        conn.execute(sa.text("""
            UPDATE provenance_artifacts pa
            SET entity_id = p.entity_id
            FROM entity_projects p
            WHERE pa.project_slug = p.slug AND pa.entity_id IS NULL
        """))
    
    if "provenance_datasets" in inspector.get_table_names():
        conn.execute(sa.text("""
            UPDATE provenance_datasets pd
            SET entity_id = p.entity_id
            FROM entity_projects p
            WHERE pd.project_slug = p.slug AND pd.entity_id IS NULL
        """))
    
    if "provenance_models" in inspector.get_table_names():
        conn.execute(sa.text("""
            UPDATE provenance_models pm
            SET entity_id = p.entity_id
            FROM entity_projects p
            WHERE pm.project_slug = p.slug AND pm.entity_id IS NULL
        """))
    
    if "provenance_evidence" in inspector.get_table_names():
        conn.execute(sa.text("""
            UPDATE provenance_evidence pe
            SET entity_id = p.entity_id
            FROM entity_projects p
            WHERE pe.project_slug = p.slug AND pe.entity_id IS NULL
        """))
    
    if "provenance_lineage" in inspector.get_table_names():
        conn.execute(sa.text("""
            UPDATE provenance_lineage pl
            SET entity_id = p.entity_id
            FROM entity_projects p
            WHERE pl.project_slug = p.slug AND pl.entity_id IS NULL
        """))
    
    if "provenance_evaluations" in inspector.get_table_names():
        conn.execute(sa.text("""
            UPDATE provenance_evaluations pe
            SET entity_id = p.entity_id
            FROM entity_projects p
            WHERE pe.project_slug = p.slug AND pe.entity_id IS NULL
        """))
    
    if "provenance_manifest_facts" in inspector.get_table_names():
        conn.execute(sa.text("""
            UPDATE provenance_manifest_facts pmf
            SET entity_id = p.entity_id
            FROM entity_projects p
            WHERE pmf.project_slug = p.slug AND pmf.entity_id IS NULL
        """))
    
    # Step 6: Backfill trust tables via project relationship
    if "trust_evaluations" in inspector.get_table_names():
        conn.execute(sa.text("""
            UPDATE trust_evaluations te
            SET entity_id = p.entity_id
            FROM entity_projects p
            WHERE te.project_slug = p.slug AND te.entity_id IS NULL
        """))
        
        if "trust_evaluation_audit" in inspector.get_table_names():
            conn.execute(sa.text("""
                UPDATE trust_evaluation_audit tea
                SET entity_id = te.entity_id
                FROM trust_evaluations te
                WHERE tea.evaluation_id = te.id AND tea.entity_id IS NULL
            """))
    
    if "trustmarks" in inspector.get_table_names():
        conn.execute(sa.text("""
            UPDATE trustmarks tm
            SET entity_id = p.entity_id
            FROM entity_projects p
            WHERE (tm.project_slug = p.slug OR tm.project_id = p.id) AND tm.entity_id IS NULL
        """))
    
    if "trust_monitoring_signals" in inspector.get_table_names():
        conn.execute(sa.text("""
            UPDATE trust_monitoring_signals tms
            SET entity_id = p.entity_id
            FROM entity_projects p
            WHERE tms.project_slug = p.slug AND tms.entity_id IS NULL
        """))
    
    if "trust_decay_events" in inspector.get_table_names():
        conn.execute(sa.text("""
            UPDATE trust_decay_events tde
            SET entity_id = p.entity_id
            FROM entity_projects p
            WHERE tde.project_slug = p.slug AND tde.entity_id IS NULL
        """))
    
    # Step 7: Backfill other tables
    if "llm_report_cache" in inspector.get_table_names():
        conn.execute(sa.text("""
            UPDATE llm_report_cache lrc
            SET entity_id = p.entity_id
            FROM entity_projects p
            WHERE lrc.project_slug = p.slug AND lrc.entity_id IS NULL
        """))
    
    if "ai_system_registry" in inspector.get_table_names():
        conn.execute(sa.text("""
            UPDATE ai_system_registry asr
            SET entity_id = p.entity_id
            FROM entity_projects p
            WHERE asr.project_slug = p.slug AND asr.entity_id IS NULL
        """))
    
    # Step 8: Backfill core tables (assign to default entity)
    conn.execute(sa.text("""
        UPDATE aims_scope
        SET entity_id = :entity_id
        WHERE entity_id IS NULL
    """).bindparams(entity_id=default_entity_id))
    
    conn.execute(sa.text("""
        UPDATE policies
        SET entity_id = :entity_id
        WHERE entity_id IS NULL
    """).bindparams(entity_id=default_entity_id))
    
    if "policy_versions" in inspector.get_table_names():
        conn.execute(sa.text("""
            UPDATE policy_versions pv
            SET entity_id = p.entity_id
            FROM policies p
            WHERE pv.policy_id = p.id AND pv.entity_id IS NULL
        """))
    
    if "policy_alerts" in inspector.get_table_names():
        conn.execute(sa.text("""
            UPDATE policy_alerts pa
            SET entity_id = p.entity_id
            FROM policies p
            WHERE pa.policy_id = p.id AND pa.entity_id IS NULL
        """))
    
    conn.execute(sa.text("""
        UPDATE audit_events
        SET entity_id = :entity_id
        WHERE entity_id IS NULL
    """).bindparams(entity_id=default_entity_id))
    
    if "euaiact_entity_definitions" in inspector.get_table_names():
        conn.execute(sa.text("""
            UPDATE euaiact_entity_definitions
            SET entity_id = :entity_id
            WHERE entity_id IS NULL
        """).bindparams(entity_id=default_entity_id))
    
    if "jira_configs" in inspector.get_table_names():
        conn.execute(sa.text("""
            UPDATE jira_configs
            SET entity_id = :entity_id
            WHERE entity_id IS NULL
        """).bindparams(entity_id=default_entity_id))
        
        if "jira_sync_history" in inspector.get_table_names():
            conn.execute(sa.text("""
                UPDATE jira_sync_history jsh
                SET entity_id = jc.entity_id
                FROM jira_configs jc
                WHERE jsh.config_id = jc.id AND jsh.entity_id IS NULL
            """))
    
    # Backfill jira_sync_metadata (via project relationship)
    if "jira_sync_metadata" in inspector.get_table_names():
        conn.execute(sa.text("""
            UPDATE jira_sync_metadata jsm
            SET entity_id = p.entity_id
            FROM entity_projects p
            WHERE jsm.project_slug = p.slug AND jsm.entity_id IS NULL
        """))
    
    # Backfill jira_risk_register (via project relationship)
    if "jira_risk_register" in inspector.get_table_names():
        conn.execute(sa.text("""
            UPDATE jira_risk_register jrr
            SET entity_id = p.entity_id
            FROM entity_projects p
            WHERE jrr.project_slug = p.slug AND jrr.entity_id IS NULL
        """))
    
    # Backfill ai_requirement_register (via project relationship)
    if "ai_requirement_register" in inspector.get_table_names():
        conn.execute(sa.text("""
            UPDATE ai_requirement_register arr
            SET entity_id = p.entity_id
            FROM entity_projects p
            WHERE arr.project_slug = p.slug AND arr.entity_id IS NULL
        """))


def downgrade() -> None:
    # No-op: Cannot safely remove entity_id assignments
    # Data would be orphaned, so downgrade is not supported
    pass
