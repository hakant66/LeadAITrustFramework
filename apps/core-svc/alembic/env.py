# alembic/env.py
from __future__ import annotations

import os
import sys
from importlib import import_module
from logging.config import fileConfig
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

from alembic import context
from sqlalchemy import engine_from_config, pool

# --- Paths --------------------------------------------------------------------
THIS_DIR = Path(__file__).resolve().parent
SERVICE_ROOT = THIS_DIR.parent  # .../apps/core-svc
WORKSPACE_ROOT = SERVICE_ROOT.parent.parent  # .../_TheLeadAI

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


def _normalize_db_url(url: str) -> str:
    # Normalize to psycopg3 driver if user provided plain postgresql://
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url


def _sanitize_url(url: str) -> str:
    # Hide password in logs
    try:
        parts = urlsplit(url)
        if parts.password:
            netloc = parts.netloc.replace(f":{parts.password}@", ":***@")
            return urlunsplit((parts.scheme, netloc, parts.path, parts.query, parts.fragment))
        return url
    except Exception:
        return "<unparseable sqlalchemy.url>"


def _resolve_sqlalchemy_url() -> str:
    # Prefer DATABASE_URL; otherwise fall back to alembic.ini sqlalchemy.url
    env_url = os.getenv("DATABASE_URL")
    if env_url:
        return _normalize_db_url(env_url)

    ini_url = config.get_main_option("sqlalchemy.url")
    if ini_url:
        return _normalize_db_url(ini_url)

    raise RuntimeError("No database URL configured. Set DATABASE_URL or sqlalchemy.url in alembic.ini.")


# Resolve URL once and set it in config so EVERYTHING uses the same value
SQLALCHEMY_URL = _resolve_sqlalchemy_url()
config.set_main_option("sqlalchemy.url", SQLALCHEMY_URL)


# --- Locate your metadata for autogenerate -----------------------------------
def load_target_metadata():
    """
    Resolve metadata from ALEMBIC_BASE if set (e.g., "app.models:Base"),
    else try a list of common fallbacks.

    IMPORTANT:
    - Eager-import sidecar modules so Base.metadata is fully populated.
      Without this, Alembic autogenerate may think tables disappeared and propose drops.
    """
    override = os.getenv("ALEMBIC_BASE")  # e.g. "app.models:Base"
    candidates = [override] if override else []
    candidates += [
        "app.models:Base",
        "models:Base",
        "core_svc.models:Base",
        "core_svc.db:Base",
        "core_svc.database:Base",
        # SQLModel fallbacks:
        "app.models:SQLModel",
        "models:SQLModel",
    ]

    errors: list[str] = []
    for spec in candidates:
        if not spec:
            continue

        mod_name, _, attr = spec.partition(":")
        try:
            mod = import_module(mod_name)

            # Ensure reflected/view tables are registered on same Base.metadata
            if mod_name == "app.models":
                for extra in (
                    "app.leadai_models_reflected",
                ):
                    try:
                        import_module(extra)
                    except Exception:
                        pass

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

# --- Autogenerate filtering ---------------------------------------------------
# Tables that exist in DB but are intentionally NOT represented in ORM metadata.
# Prevent Alembic autogenerate from proposing DROP TABLE / DROP INDEX / DROP CONSTRAINT for these.
DB_ONLY_TABLES = {
    "evidence",
    "evidence_audit",
    "control_values",
    "kpi_definition",
    "provenance_manifest_facts",
    "provenance_evaluations",
}


def include_object(obj, name, type_, reflected, compare_to):
    """
    Control what Alembic includes in autogenerate comparisons.

    Notes:
    - For db-only tables, we also skip related indexes/constraints because Alembic may
      surface them as separate objects (index/unique_constraint/foreign_key_constraint).
    - We keep schema-awareness so we don’t accidentally filter similarly named objects
      in other schemas.
    """
    schema = getattr(obj, "schema", None)

    # 1) Ignore DB-only tables (public schema by default)
    if type_ == "table" and (schema in (None, "public")) and name in DB_ONLY_TABLES:
        return False

    # 2) Also ignore indexes/constraints that belong to those DB-only tables
    parent_table = getattr(obj, "table", None)
    if parent_table is not None:
        pt_name = getattr(parent_table, "name", None)
        pt_schema = getattr(parent_table, "schema", None)
        if (pt_schema in (None, "public")) and pt_name in DB_ONLY_TABLES:
            return False

    # 3) Prevent kpi_values from being (re)created by autogenerate (belt + suspenders)
    if type_ == "table" and (schema in (None, "public")) and name == "kpi_values":
        return False

    # Optional: if you ever reflect views and Alembic treats them as "table", you can skip them.
    # Example heuristic: skip objects without a primary key and marked as 'is_view' in info.
    # (Leave off unless you have that convention.)
    return True


def _log_runtime_info(connection=None) -> None:
    # Breadcrumbs to catch wrong DB URL / wrong script head instantly.
    print(f"[alembic] sqlalchemy.url = {_sanitize_url(SQLALCHEMY_URL)}")
    try:
        from alembic.script import ScriptDirectory

        script = ScriptDirectory.from_config(config)
        print(f"[alembic] migration script heads = {script.get_heads()}")
    except Exception:
        pass

    if connection is not None:
        try:
            from alembic.runtime.migration import MigrationContext

            mc = MigrationContext.configure(connection)
            print(f"[alembic] db current revision = {mc.get_current_revision()}")
        except Exception:
            pass


# --- Offline / Online runners -------------------------------------------------
def run_migrations_offline():
    _log_runtime_info(connection=None)
    context.configure(
        url=SQLALCHEMY_URL,
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

    with connectable.begin() as connection:
        _log_runtime_info(connection=connection)

        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            include_object=include_object,
            compare_type=True,
            compare_server_default=True,
        )

        context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

