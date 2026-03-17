"""Add calculated_score to pillar_overrides(+history) and update audit trigger

Revision ID: 20260302_add_pillar_calculated_score
Revises: 20260301_intelligent_alerts
Create Date: 2026-03-02
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20260302_add_pillar_calculated_score"
down_revision = "20260301_intelligent_alerts"
branch_labels = None
depends_on = None


def _columns(inspector, table_name: str) -> set[str]:
    return {col["name"] for col in inspector.get_columns(table_name)}


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names(schema="public")
    if "pillar_overrides" not in tables:
        return

    po_cols = _columns(inspector, "pillar_overrides")
    if "calculated_score" not in po_cols:
        op.add_column(
            "pillar_overrides",
            sa.Column("calculated_score", sa.Float(precision=53), nullable=True),
            schema="public",
        )

    if "pillar_overrides_history" in tables:
        poh_cols = _columns(inspector, "pillar_overrides_history")
        if "calculated_score" not in poh_cols:
            op.add_column(
                "pillar_overrides_history",
                sa.Column("calculated_score", sa.Float(precision=53), nullable=True),
                schema="public",
            )

        # Update trigger function to include calculated_score (and entity_id if present)
        po_cols = _columns(inspector, "pillar_overrides")
        poh_cols = _columns(inspector, "pillar_overrides_history")
        if "calculated_score" in po_cols and "calculated_score" in poh_cols:
            include_entity_id = "entity_id" in po_cols and "entity_id" in poh_cols
            entity_col = "entity_id, " if include_entity_id else ""
            entity_val_new = "NEW.entity_id, " if include_entity_id else ""
            entity_val_old = "OLD.entity_id, " if include_entity_id else ""

            op.execute(
                f"""
                CREATE OR REPLACE FUNCTION public.trg_audit_pillar_overrides()
                RETURNS trigger
                LANGUAGE plpgsql
                AS $$
                DECLARE
                  who RECORD;
                BEGIN
                  SELECT
                    current_setting('app.user', true)   AS auser,
                    current_setting('app.reason', true) AS areason,
                    current_setting('app.source', true) AS asource
                  INTO who;

                  IF (TG_OP = 'INSERT') THEN
                    INSERT INTO public.pillar_overrides_history
                      (id, {entity_col}project_id, pillar_key, pillar_name, score_pct, calculated_score, maturity, weight, updated_at,
                       audit_id, op, changed_at, audit_user, audit_txid, audit_reason, audit_source)
                    VALUES
                      (NEW.id, {entity_val_new}NEW.project_id, NEW.pillar_key, NEW.pillar_name, NEW.score_pct, NEW.calculated_score, NEW.maturity, NEW.weight, NEW.updated_at,
                       gen_random_uuid(), 'INSERT', now(), coalesce(who.auser,''),
                       txid_current(), coalesce(who.areason,''), coalesce(who.asource,''));
                    RETURN NEW;

                  ELSIF (TG_OP = 'UPDATE') THEN
                    INSERT INTO public.pillar_overrides_history
                      (id, {entity_col}project_id, pillar_key, pillar_name, score_pct, calculated_score, maturity, weight, updated_at,
                       audit_id, op, changed_at, audit_user, audit_txid, audit_reason, audit_source)
                    VALUES
                      (NEW.id, {entity_val_new}NEW.project_id, NEW.pillar_key, NEW.pillar_name, NEW.score_pct, NEW.calculated_score, NEW.maturity, NEW.weight, NEW.updated_at,
                       gen_random_uuid(), 'UPDATE', now(), coalesce(who.auser,''),
                       txid_current(), coalesce(who.areason,''), coalesce(who.asource,''));
                    RETURN NEW;

                  ELSIF (TG_OP = 'DELETE') THEN
                    INSERT INTO public.pillar_overrides_history
                      (id, {entity_col}project_id, pillar_key, pillar_name, score_pct, calculated_score, maturity, weight, updated_at,
                       audit_id, op, changed_at, audit_user, audit_txid, audit_reason, audit_source)
                    VALUES
                      (OLD.id, {entity_val_old}OLD.project_id, OLD.pillar_key, OLD.pillar_name, OLD.score_pct, OLD.calculated_score, OLD.maturity, OLD.weight, OLD.updated_at,
                       gen_random_uuid(), 'DELETE', now(), coalesce(who.auser,''),
                       txid_current(), coalesce(who.areason,''), coalesce(who.asource,''));
                    RETURN OLD;
                  END IF;

                  RETURN NULL;
                END;
                $$;
                """
            )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names(schema="public")

    if "pillar_overrides" in tables and "pillar_overrides_history" in tables:
        poh_cols = _columns(inspector, "pillar_overrides_history")
        po_cols = _columns(inspector, "pillar_overrides")
        include_entity_id = "entity_id" in po_cols and "entity_id" in poh_cols
        entity_col = "entity_id, " if include_entity_id else ""
        entity_val_new = "NEW.entity_id, " if include_entity_id else ""
        entity_val_old = "OLD.entity_id, " if include_entity_id else ""

        op.execute(
            f"""
            CREATE OR REPLACE FUNCTION public.trg_audit_pillar_overrides()
            RETURNS trigger
            LANGUAGE plpgsql
            AS $$
            DECLARE
              who RECORD;
            BEGIN
              SELECT
                current_setting('app.user', true)   AS auser,
                current_setting('app.reason', true) AS areason,
                current_setting('app.source', true) AS asource
              INTO who;

              IF (TG_OP = 'INSERT') THEN
                INSERT INTO public.pillar_overrides_history
                  (id, {entity_col}project_id, pillar_key, pillar_name, score_pct, maturity, weight, updated_at,
                   audit_id, op, changed_at, audit_user, audit_txid, audit_reason, audit_source)
                VALUES
                  (NEW.id, {entity_val_new}NEW.project_id, NEW.pillar_key, NEW.pillar_name, NEW.score_pct, NEW.maturity, NEW.weight, NEW.updated_at,
                   gen_random_uuid(), 'INSERT', now(), coalesce(who.auser,''),
                   txid_current(), coalesce(who.areason,''), coalesce(who.asource,''));
                RETURN NEW;

              ELSIF (TG_OP = 'UPDATE') THEN
                INSERT INTO public.pillar_overrides_history
                  (id, {entity_col}project_id, pillar_key, pillar_name, score_pct, maturity, weight, updated_at,
                   audit_id, op, changed_at, audit_user, audit_txid, audit_reason, audit_source)
                VALUES
                  (NEW.id, {entity_val_new}NEW.project_id, NEW.pillar_key, NEW.pillar_name, NEW.score_pct, NEW.maturity, NEW.weight, NEW.updated_at,
                   gen_random_uuid(), 'UPDATE', now(), coalesce(who.auser,''),
                   txid_current(), coalesce(who.areason,''), coalesce(who.asource,''));
                RETURN NEW;

              ELSIF (TG_OP = 'DELETE') THEN
                INSERT INTO public.pillar_overrides_history
                  (id, {entity_col}project_id, pillar_key, pillar_name, score_pct, maturity, weight, updated_at,
                   audit_id, op, changed_at, audit_user, audit_txid, audit_reason, audit_source)
                VALUES
                  (OLD.id, {entity_val_old}OLD.project_id, OLD.pillar_key, OLD.pillar_name, OLD.score_pct, OLD.maturity, OLD.weight, OLD.updated_at,
                   gen_random_uuid(), 'DELETE', now(), coalesce(who.auser,''),
                   txid_current(), coalesce(who.areason,''), coalesce(who.asource,''));
                RETURN OLD;
              END IF;

              RETURN NULL;
            END;
            $$;
            """
        )

    if "pillar_overrides_history" in tables:
        cols = _columns(inspector, "pillar_overrides_history")
        if "calculated_score" in cols:
            op.drop_column("pillar_overrides_history", "calculated_score", schema="public")

    if "pillar_overrides" in tables:
        cols = _columns(inspector, "pillar_overrides")
        if "calculated_score" in cols:
            op.drop_column("pillar_overrides", "calculated_score", schema="public")
