"""
Policy template FK validation (integration)
"""

import os
from uuid import uuid4

import pytest
import psycopg
from psycopg import errors as pg_errors


def test_policy_template_fk_enforced():
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        pytest.skip("DATABASE_URL not set")
    if db_url.startswith("postgresql+psycopg://"):
        db_url = db_url.replace("postgresql+psycopg://", "postgresql://", 1)

    template_id = uuid4()
    policy_id_ok = f"policy-{uuid4()}"
    policy_id_bad = f"policy-{uuid4()}"

    with psycopg.connect(db_url) as conn:
        # Insert a valid template and policy referencing it
        with conn.transaction():
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO policy_template (id, status) VALUES (%s, %s)",
                    (template_id, "active"),
                )
                cur.execute(
                    """
                    INSERT INTO policies (id, title, status, template, created_at, updated_at)
                    VALUES (%s, %s, 'draft', %s, NOW(), NOW())
                    """,
                    (policy_id_ok, f"FK OK {policy_id_ok}", template_id),
                )

        # Invalid template should fail
        with pytest.raises(pg_errors.ForeignKeyViolation):
            with conn.transaction():
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO policies (id, title, status, template, created_at, updated_at)
                        VALUES (%s, %s, 'draft', %s, NOW(), NOW())
                        """,
                        (policy_id_bad, f"FK BAD {policy_id_bad}", uuid4()),
                    )

        # Cleanup
        with conn.transaction():
            with conn.cursor() as cur:
                cur.execute("DELETE FROM policies WHERE id = %s", (policy_id_ok,))
                cur.execute("DELETE FROM policy_template WHERE id = %s", (template_id,))
