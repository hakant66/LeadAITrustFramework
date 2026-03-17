# apps/core-svc/alembic/versions/20260215_backfill_kpi_nist_clause_from_iso.py
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
import re

# --- Alembic identifiers ---
revision = "1d2e3f4a5b6c"
down_revision = "1c2d3e4f5a6b"
branch_labels = None
depends_on = None


ISO_TO_NIST = {
    "4.1 context of the organisation": "MAP 1.3",
    "4.2 stakeholders": "MAP 5.2",
    "4.3 scope of aims": "MAP 3.3",
    "4.4 aims establishment": "GOVERN 1.4",
    "5.1 leadership & commitment": "GOVERN 2.3",
    "5.2 ai policy": "GOVERN 1.2",
    "5.3 roles & responsibilities": "GOVERN 2.1",
    "6.1 risk & opportunity planning": "GOVERN 1.3",
    "6.2 ai objectives": "MANAGE 1.1",
    "7.1 resources": "MANAGE 2.1",
    "7.2 competence": "GOVERN 2.2",
    "7.3 awareness": "GOVERN 2.2",
    "7.4 communication": "GOVERN 2.1",
    "7.5 documented information": "MAP 2.2",
    "8.1 operational planning": "MAP 1.6",
    "8.1 monitoring": "MEASURE 2.4",
    "8.2 data governance": "MAP 2.3; MEASURE 2.11",
    "8.3 ai system design & development": "MAP 2.1",
    "8.4 intended purpose": "MAP 1.1",
    "8.5 transparency": "MEASURE 2.9",
    "8.6 human oversight": "MAP 3.5",
    "8.7 accuracy & robustness": "MEASURE 2.6",
    "8.8 cybersecurity": "MEASURE 2.7",
    "8.9 supplier & third parties": "GOVERN 6.1",
    "8.11 incident handling": "MANAGE 4.3",
    "9.1 measurement & evaluation": "MEASURE 1.2",
    "9.2 internal audit": "MEASURE 1.3",
    "9.3 management review": "GOVERN 1.5",
    "10.1 nonconformity & corrective action": "MANAGE 2.3",
    "10.2 continual improvement": "MANAGE 4.2",
}


def _normalize(value: str) -> str:
    if not value:
        return ""
    value = value.strip().lower()
    value = re.sub(r"\s+", " ", value)
    return value


def _expand_nist(value: str) -> list[str]:
    if not value:
        return []
    parts = [v.strip() for v in value.split(";") if v.strip()]
    return parts


def upgrade():
    bind = op.get_bind()
    rows = bind.execute(
        sa.text(
            """
            SELECT kpi_key, iso_42001_clause, nist_clause
            FROM kpi_definition
            WHERE iso_42001_clause IS NOT NULL
            """
        )
    ).fetchall()

    for kpi_key, iso_clause, nist_clause in rows:
        if nist_clause and str(nist_clause).strip():
            continue
        segments = [seg.strip() for seg in str(iso_clause).split(";")]
        mapped: list[str] = []
        for seg in segments:
            key = _normalize(seg)
            if not key:
                continue
            mapped_values = ISO_TO_NIST.get(key)
            for clause in _expand_nist(mapped_values):
                if clause not in mapped:
                    mapped.append(clause)
        if not mapped:
            continue
        bind.execute(
            sa.text(
                """
                UPDATE kpi_definition
                SET nist_clause = :nist_clause
                WHERE kpi_key = :kpi_key
                """
            ),
            {"nist_clause": "; ".join(mapped), "kpi_key": kpi_key},
        )


def downgrade():
    # Leave any manual edits intact; no downgrade data wipe.
    pass
