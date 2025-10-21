<!-- Copilot instructions for TheLeadAI monorepo -->
# TheLeadAI — Copilot / AI agent quick guide

This repository is a small monorepo with a Next.js frontend (apps/web) and a Python FastAPI backend (apps/core-svc). Use these notes to make safe, targeted code changes and follow the project's conventions.

## Key components
- **apps/web** — Next.js 13+ app dir UI. Dev server: `pnpm --filter ./apps/web dev` (or run `pnpm dev` from the `apps/web` folder). See `apps/web/README.md` and `apps/web/src` for components.
- **apps/core-svc** — FastAPI backend. Entry: `apps/core-svc/app/main.py`. Database layer uses SQLAlchemy models in `apps/core-svc/app/models.py` and `apps/core-svc/app/db.py`.
- **migrations** — `apps/core-svc/alembic/` (config in `apps/core-svc/alembic.ini`) — use Alembic for schema changes.
- **infra helpers** — `docker-compose.yml` starts Postgres, Redis, and MinIO used by services for local development.

## How the pieces fit
- The Next.js UI calls FastAPI endpoints (see `apps/core-svc/app/*` routers). FastAPI exposes `/healthz` which pings PostgreSQL using the SQLAlchemy engine defined in `apps/core-svc/app/db.py`.
- Database connection strings are assembled in `apps/core-svc/app/settings.py` (env vars PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE).
- Alembic uses `apps/core-svc/alembic.ini` with the DB URL set; migrations live under `apps/core-svc/alembic/versions`.
- Shared TypeScript utilities are located in `packages/shared-ts/`.

## Developer workflows
### Local infrastructure
- Start local infra: from repo root run `docker compose up -d` to bring up Postgres, Redis, and MinIO (docker-compose.yml uses service names `postgres`, `redis`, `minio`).

### Backend development
1. Navigate to `apps/core-svc`.
2. Create a virtual environment and install dependencies:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```
3. Run the FastAPI server with uvicorn:
   ```bash
   uvicorn app.main:app --reload --port 8001 --host 0.0.0.0
   ```

### Frontend development
1. Navigate to `apps/web`.
2. Start the Next.js development server:
   ```bash
   pnpm dev
   ```
   The UI expects the backend at `http://localhost:8001` (CORS is configured in `main.py`).

### Database migrations
- Create a migration:
  ```bash
  alembic revision --autogenerate -m "describe change"
  ```
- Apply migrations:
  ```bash
  alembic upgrade head
  ```

## Project conventions and patterns
- **Backend**: Use FastAPI + SQLAlchemy 2.0 ORM mapped models in `models.py`. Use `get_session()` from `db.py` or the engine directly.
- **Frontend**: Organize React server/client components under `apps/web/src/app`. Shared UI components are in `(components)`.
- **UUIDs**: Generated as strings via `uuid_str()` in `models.py` (models default to String primary keys). Respect this when adding fixtures or tests.
- **Migrations**: Alembic autogeneration is used; migration files already exist in `apps/core-svc/alembic/versions/`.
- **Testing**: Ensure changes are tested locally against the docker-compose Postgres instance.

## Integration points / external dependencies
- **Postgres (DB)**: Used by core-svc — docker-compose provides a default local instance.
- **Redis & MinIO**: Included for caching and object storage; code references may live in other services.
- **pnpm**: The monorepo uses pnpm (see root `pnpm-workspace.yaml`) — prefer `pnpm` for Node installations.

## Safety & typical edits
- When changing DB models, add a migration (alembic revision) and run tests locally.
- Keep API routers small and include route path examples when adding new endpoints (see `apps/core-svc/app/scorecard.py` for router patterns).
- For frontend changes, prefer editing components under `apps/web/src/app/(components)` and use Next's dev server to validate.

## Useful files to inspect when coding
- `apps/core-svc/app/main.py`, `apps/core-svc/app/db.py`, `apps/core-svc/app/models.py`, `apps/core-svc/alembic.ini`
- `apps/web/README.md`, `apps/web/src/app/page.tsx`, `apps/web/src/app/(components)`
- `docker-compose.yml`, `pnpm-workspace.yaml`

If anything above is unclear, tell me which area you want clarified (backend model patterns, migration steps, or frontend build/dev) and I'll expand with examples or edit this file.
