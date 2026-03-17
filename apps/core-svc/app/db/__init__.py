# apps/core-svc/app/db/__init__.py
import os
from typing import Generator
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Connection

DATABASE_URL = os.getenv("DATABASE_URL") or os.getenv("SQLALCHEMY_DATABASE_URI")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL not set")

# One shared engine for the app
engine = create_engine(DATABASE_URL, pool_pre_ping=True, future=True)

def ping_db() -> bool:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False

# FastAPI dependency: yield a Connection and ensure it closes
def get_db() -> Generator[Connection, None, None]:
    conn = engine.connect()
    try:
        yield conn
    finally:
        conn.close()
