<!-- Copilot instructions for TheLeadAI monorepo -->
# TheLeadAI — Copilot / AI agent quick guide

This repository is a small monorepo with a Next.js frontend (apps/web) and a Python FastAPI backend (apps/core-svc). Use these notes to make safe, targeted code changes and follow the project's conventions.

Key components
- apps/web — Next.js 13+ app dir UI. Dev server: `pnpm --filter ./apps/web dev` (or run `pnpm dev` from the `apps/web` folder). See `apps/web/README.md` and `apps/web/src` for components.
- apps/core-svc — FastAPI backend. Entry: `apps/core-svc/app/main.py`. Database layer uses SQLAlchemy models in `apps/core-svc/app/models.py` and `apps/core-svc/app/db.py`.
- migrations — `apps/core-svc/alembic/` (config in `apps/core-svc/alembic.ini`) — use Alembic for schema changes.
- infra helpers — `docker-compose.yml` starts Postgres, Redis and MinIO used by services for local development.

How the pieces fit
- The Next.js UI calls FastAPI endpoints (see `apps/core-svc/app/*` routers). FastAPI exposes `/healthz` which pings PostgreSQL using the SQLAlchemy engine defined in `apps/core-svc/app/db.py`.
- Database connection strings are assembled in `apps/core-svc/app/settings.py` (env vars PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE).
- Alembic uses `apps/core-svc/alembic.ini` with the DB URL set; migrations live under `apps/core-svc/alembic/versions`.

Developer workflows (concrete)
- Start local infra: from repo root run `docker compose up -d` to bring up postgres, redis, minio (docker-compose.yml uses service names `postgres`, `redis`, `minio`).
- Backend (development): in `apps/core-svc` create a venv and install requirements from `apps/core-svc/requirements.txt`, then run with uvicorn:
  - uvicorn command (example): `uvicorn app.main:app --reload --port 8001 --host 0.0.0.0`
- Frontend (development): `cd apps/web && pnpm dev` (Next defaults to :3000). The UI expects backend at `http://localhost:8001` (CORS is configured in `main.py`).
- Migrations:
  - Create revision: from `apps/core-svc` run `alembic revision --autogenerate -m "describe change"` (alembic.ini points to local DB URL by default).
  - Apply migrations: `alembic upgrade head`.

Project conventions and patterns
- Python services use classic FastAPI + SQLAlchemy 2.0 ORM mapped models in `models.py`. Use `get_session()` from `db.py` or the engine directly.
- UUIDs are generated as strings via `uuid_str()` in `models.py` (models default to String primary keys). Respect this when adding fixtures or tests.
- Alembic autogeneration is used; migration files already exist in `apps/core-svc/alembic/versions/`.
- Frontend: Next.js app dir with React server/client components under `apps/web/src/app`. Small (components) folder contains shared UI components used across pages.

Integration points / external deps to watch
- Postgres (DB): used by core-svc — docker-compose provides a default local instance.
- Redis & MinIO: included for caching and object storage; code references may live in other services.
- The monorepo uses pnpm (see root `pnpm-workspace.yaml`) — prefer `pnpm` for Node installations.

Safety & typical edits
- When changing DB models, add a migration (alembic revision) and run tests locally against the docker-compose Postgres.
- Keep API routers small and include route path examples when adding new endpoints (see `apps/core-svc/app/scorecard.py` for router patterns).
- For frontend changes, prefer editing components under `apps/web/src/app/(components)` and use Next's dev server to validate.

Useful files to inspect when coding
- `apps/core-svc/app/main.py`, `apps/core-svc/app/db.py`, `apps/core-svc/app/models.py`, `apps/core-svc/alembic.ini`
- `apps/web/README.md`, `apps/web/src/app/page.tsx`, `apps/web/src/app/(components)`
- `docker-compose.yml`, `pnpm-workspace.yaml`

If anything above is unclear, tell me which area you want clarified (backend model patterns, migration steps, or frontend build/dev) and I'll expand with examples or edit this file.
