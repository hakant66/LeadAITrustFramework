"""add helper tooltips for ai_system_registry fields

Revision ID: 20260222_add_ai_system_helper_tooltips
Revises: 20260224_add_model_cards_and_langfuse
Create Date: 2026-02-22
"""
from __future__ import annotations

import json
from alembic import op

revision = "20260222_add_ai_system_helper_tooltips"
down_revision = "20260224_add_model_cards_and_langfuse"
branch_labels = None
depends_on = None


HELPER_ROWS = [
    (
        "model_type",
        "Category of model (LLM, classifier, scorer).",
        ["LLM", "Classifier", "Scorer", "Embedding", "Reranker"],
    ),
    (
        "deployment_environment",
        "Environment where the model is deployed.",
        ["prod", "staging", "sandbox"],
    ),
    (
        "lifecycle_stage",
        "Current lifecycle stage of the model.",
        ["design", "train", "validate", "deploy", "retire"],
    ),
]


def upgrade() -> None:
    for field_name, description, values in HELPER_ROWS:
        vals_json = json.dumps(values).replace("'", "''")
        op.execute(
            """
            INSERT INTO ai_system_registry_helper (field_name, description, helper_values)
            VALUES ('{field_name}', '{description}', '{vals_json}'::jsonb)
            ON CONFLICT (field_name)
            DO UPDATE SET description = EXCLUDED.description,
                          helper_values = EXCLUDED.helper_values
            """.format(
                field_name=field_name.replace("'", "''"),
                description=(description or "").replace("'", "''"),
                vals_json=vals_json,
            )
        )


def downgrade() -> None:
    op.execute(
        "DELETE FROM ai_system_registry_helper WHERE field_name IN ('model_type','deployment_environment','lifecycle_stage')"
    )
