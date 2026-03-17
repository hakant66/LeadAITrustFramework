#!/usr/bin/env python3
"""List tables that have entity_id and/or entity_slug. Run from core-svc container or with DATABASE_URL set."""
from __future__ import annotations

import os
from sqlalchemy import create_engine, text

def main() -> None:
    url = os.environ.get("DATABASE_URL", "postgresql+psycopg://leadai:leadai@postgres:5432/leadai")
    engine = create_engine(url)
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT table_name,
                   bool_or(column_name = 'entity_id') AS has_entity_id,
                   bool_or(column_name = 'entity_slug') AS has_entity_slug
            FROM information_schema.columns
            WHERE table_schema = 'public'
            GROUP BY table_name
            ORDER BY table_name
        """))
        print("Table                      | entity_id | entity_slug")
        print("---------------------------|-----------|------------")
        for r in rows:
            ei = "yes" if r.has_entity_id else "no"
            es = "yes" if r.has_entity_slug else "no"
            print(f"{r.table_name:26} | {ei:9} | {es}")

if __name__ == "__main__":
    main()
