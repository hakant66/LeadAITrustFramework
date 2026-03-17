"""fix control_values_history trigger ordering

Revision ID: c2d3e4f5a6b7
Revises: 4e889ff3d073
Create Date: 2026-02-16
"""
from alembic import op

# revision identifiers, used by Alembic.
revision = "c2d3e4f5a6b7"
down_revision = "4e889ff3d073"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        """
        CREATE OR REPLACE FUNCTION public.trg_audit_control_values()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        DECLARE
          who RECORD;
        BEGIN
          SELECT * INTO who FROM public._audit_who();

          IF (TG_OP = 'INSERT') THEN
            INSERT INTO public.control_values_history (
              project_slug, kpi_key, raw_value, normalized_pct, observed_at, updated_at,
              control_id, target_text, target_numeric, evidence_source, owner_role,
              frequency, failure_action, maturity_anchor_l3, current_value, as_of, notes, kpi_score,
              audit_id, audit_action, audit_ts, audit_user, audit_txid, audit_reason, audit_source,
              entity_id, entity_slug
            ) VALUES (
              NEW.project_slug, NEW.kpi_key, NEW.raw_value, NEW.normalized_pct, NEW.observed_at, NEW.updated_at,
              NEW.control_id, NEW.target_text, NEW.target_numeric, NEW.evidence_source, NEW.owner_role,
              NEW.frequency, NEW.failure_action, NEW.maturity_anchor_l3, NEW.current_value, NEW.as_of, NEW.notes, NEW.kpi_score,
              gen_random_uuid(), 'INSERT', now(), who.auser, txid_current(), who.areason, who.asource,
              NEW.entity_id, NEW.entity_slug
            );
            RETURN NEW;
          ELSIF (TG_OP = 'UPDATE') THEN
            INSERT INTO public.control_values_history (
              project_slug, kpi_key, raw_value, normalized_pct, observed_at, updated_at,
              control_id, target_text, target_numeric, evidence_source, owner_role,
              frequency, failure_action, maturity_anchor_l3, current_value, as_of, notes, kpi_score,
              audit_id, audit_action, audit_ts, audit_user, audit_txid, audit_reason, audit_source,
              entity_id, entity_slug
            ) VALUES (
              NEW.project_slug, NEW.kpi_key, NEW.raw_value, NEW.normalized_pct, NEW.observed_at, NEW.updated_at,
              NEW.control_id, NEW.target_text, NEW.target_numeric, NEW.evidence_source, NEW.owner_role,
              NEW.frequency, NEW.failure_action, NEW.maturity_anchor_l3, NEW.current_value, NEW.as_of, NEW.notes, NEW.kpi_score,
              gen_random_uuid(), 'UPDATE', now(), who.auser, txid_current(), who.areason, who.asource,
              NEW.entity_id, NEW.entity_slug
            );
            RETURN NEW;
          ELSIF (TG_OP = 'DELETE') THEN
            INSERT INTO public.control_values_history (
              project_slug, kpi_key, raw_value, normalized_pct, observed_at, updated_at,
              control_id, target_text, target_numeric, evidence_source, owner_role,
              frequency, failure_action, maturity_anchor_l3, current_value, as_of, notes, kpi_score,
              audit_id, audit_action, audit_ts, audit_user, audit_txid, audit_reason, audit_source,
              entity_id, entity_slug
            ) VALUES (
              OLD.project_slug, OLD.kpi_key, OLD.raw_value, OLD.normalized_pct, OLD.observed_at, OLD.updated_at,
              OLD.control_id, OLD.target_text, OLD.target_numeric, OLD.evidence_source, OLD.owner_role,
              OLD.frequency, OLD.failure_action, OLD.maturity_anchor_l3, OLD.current_value, OLD.as_of, OLD.notes, OLD.kpi_score,
              gen_random_uuid(), 'DELETE', now(), who.auser, txid_current(), who.areason, who.asource,
              OLD.entity_id, OLD.entity_slug
            );
            RETURN OLD;
          END IF;

          RETURN NULL;
        END;
        $$;
        """
    )


def downgrade():
    op.execute(
        """
        CREATE OR REPLACE FUNCTION public.trg_audit_control_values()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        DECLARE
          who RECORD;
        BEGIN
          SELECT * INTO who FROM public._audit_who();
          IF (TG_OP = 'INSERT') THEN
            INSERT INTO public.control_values_history
            SELECT (NEW).*, gen_random_uuid(),'INSERT',now(),who.auser,txid_current(),who.areason,who.asource;
            RETURN NEW;
          ELSIF (TG_OP = 'UPDATE') THEN
            INSERT INTO public.control_values_history
            SELECT (NEW).*, gen_random_uuid(),'UPDATE',now(),who.auser,txid_current(),who.areason,who.asource;
            RETURN NEW;
          ELSIF (TG_OP = 'DELETE') THEN
            INSERT INTO public.control_values_history
            SELECT (OLD).*, gen_random_uuid(),'DELETE',now(),who.auser,txid_current(),who.areason,who.asource;
            RETURN OLD;
          END IF;
        END;
        $$;
        """
    )
