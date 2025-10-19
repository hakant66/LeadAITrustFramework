# app/db.py
import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker


# Use your actual DSN; example:
# postgresql+psycopg://leadai:leadai@localhost:5432/leadai
DATABASE_URL = "postgresql+psycopg://leadai:leadai@localhost:5432/leadai"

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
