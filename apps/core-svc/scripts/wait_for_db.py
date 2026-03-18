from __future__ import annotations

import os
import time

import psycopg


def _normalize_dsn(dsn: str) -> str:
    if dsn.startswith("postgresql+psycopg://"):
        return dsn.replace("postgresql+psycopg://", "postgresql://", 1)
    return dsn


def main() -> None:
    dsn = _normalize_dsn(os.environ["DATABASE_URL"])
    timeout = int(os.getenv("DB_STARTUP_TIMEOUT_SECONDS", "90"))
    deadline = time.time() + timeout
    last_error: Exception | None = None

    while time.time() < deadline:
        try:
            with psycopg.connect(dsn, connect_timeout=5) as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT 1")
                    cur.fetchone()
            print("[startup] database is reachable")
            return
        except Exception as exc:  # pragma: no cover - startup path
            last_error = exc
            print(f"[startup] waiting for database: {exc}")
            time.sleep(2)

    raise SystemExit(f"database not reachable within {timeout}s: {last_error}")


if __name__ == "__main__":
    main()
