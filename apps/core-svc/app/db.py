# app/db.py
import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.settings import settings


# Use env when available; fall back to PG* settings for local/dev.
DATABASE_URL = (
    os.getenv("DATABASE_URL")
    or os.getenv("SQLALCHEMY_DATABASE_URI")
    or settings.sqlalchemy_url
)

engine = create_engine(DATABASE_URL, pool_pre_ping=True, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)

def get_session():
    return SessionLocal()

def ping_db() -> bool:
    try:
        with engine.connect() as c:
            c.execute(text("SELECT 1"))
        return True
    except Exception:
        return False
