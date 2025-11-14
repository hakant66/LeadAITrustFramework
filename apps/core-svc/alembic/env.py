# alembic/env.py
from __future__ import annotations

import os
import sys
from logging.config import fileConfig
from importlib import import_module
from pathlib import Path

from alembic import context
from sqlalchemy import engine_from_config, pool

# --- Paths --------------------------------------------------------------------
THIS_DIR = Path(__file__).resolve().parent
SERVICE_ROOT = THIS_DIR.parent                # .../apps/core-svc
WORKSPACE_ROOT = SERVICE_ROOT.parent.parent   # .../_TheLeadAI

# Make project importable (service root and optional ./src)
sys.path.insert(0, str(SERVICE_ROOT))
SRC = SERVICE_ROOT / "src"
if SRC.exists():
    sys.path.insert(0, str(SRC))

# --- Load .env (optional) -----------------------------------------------------
try:
    from dotenv import load_dotenv
    for env_path in (SERVICE_ROOT / ".env", WORKSPACE_ROOT / ".env"):
        if env_path.exists():
            load_dotenv(env_path, override=False)
except Exception:
    # .env loading is optional
    pass

# --- Alembic config -----------------------------------------------------------
config = context.config
if config.config_file_name:
    fileConfig(config.config_file_name)

# Respect DATABASE_URL if provided, and normalize to psycopg3 driver.
db_url = os.getenv("DATABASE_URL")
if db_url:
    if db_url.startswith("postgresql://"):
        db_url = db_url.replace("postgresql://", "postgresql+psycopg://", 1)
    config.set_main_option("sqlalchemy.url", db_url)

# --- Locate your metadata for autogenerate -----------------------------------
def load_target_metadata():
    """
    Resolve metadata from ALEMBIC_BASE if set (e.g., "app.models:Base"),
    else try a list of common fallbacks.
    """
    override = os.getenv("ALEMBIC_BASE")  # e.g. "app.models:Base" or "app.models:SQLModel"
    candidates = [override] if override else []
    candidates += [
        "app.models:Base",        # common project location
        "models:Base",
        "core_svc.models:Base",
        "core_svc.db:Base",
        "core_svc.database:Base",
        # SQLModel fallbacks:
        "app.models:SQLModel",
        "models:SQLModel",
    ]

    errors = []
    for spec in candidates:
        if not spec:
            continue
        mod_name, _, attr = spec.partition(":")
        try:
            mod = import_module(mod_name)
            obj = getattr(mod, attr) if attr else getattr(mod, "Base")
            metadata = getattr(obj, "metadata", None)
            if metadata is not None:
                return metadata
        except Exception as e:
            errors.append(f"{spec} -> {type(e).__name__}: {e}")

    raise ImportError(
        "Alembic could not locate your metadata. "
        "Set ALEMBIC_BASE='package.module:Base' (or ':SQLModel') or edit env.py.\n"
        "Tried:\n  - " + "\n  - ".join(errors)
    )

target_metadata = load_target_metadata()

def include_object(object, name, type_, reflected, compare_to):
    # include everything by default; customize if you need to skip views, etc.
    return True

# --- Offline / Online runners -------------------------------------------------
def run_migrations_offline():
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_object=include_object,
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online():
    connectable = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            include_object=include_object,
            compare_type=True,
            compare_server_default=True,
        )
        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
