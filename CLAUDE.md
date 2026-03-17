# LeadAI Trust Framework - AI Development Guide

## Architecture Overview
This is a containerized monorepo. All services are orchestrated via Docker Compose.
- **Web Frontend:** Next.js (Node 20+) in `apps/web`
- **Core Service:** FastAPI (Python 3.13) in `apps/core-svc`
- **Certificate Service:** FastAPI in `apps/cert-svc`
- **MCP Server:** Model Context Protocol in `apps/mcp`
- **Database:** PostgreSQL (managed via SQLAlchemy/Alembic)

## Docker & Environment Commands
- **Start All Services:** `docker compose up -d`
- **Rebuild Services:** `docker compose up -d --build`
- **Stop Services:** `docker compose down`
- **View Logs:** `docker compose logs -f [service_name]` (e.g., `web`, `core-svc`)
- **Execute into Container:** `docker exec -it [container_name] /bin/bash`

## Development Workflows
### Backend (Python/FastAPI)
- **Path:** `apps/core-svc`
- **Migrations:** `docker exec -it core-svc alembic upgrade head`
- **Create Migration:** `docker exec -it core-svc alembic revision --autogenerate -m "description"`
- **Linting:** Follow PEP 8 (snake_case for functions/variables).

### Frontend (Next.js)
- **Path:** `apps/web`
- **Package Manager:** `pnpm`
- **Commands:** Use `docker exec` for pnpm commands if running inside Docker, otherwise local `pnpm dev`.
- **UI Components:** Tailwind CSS + Lucide Icons. Follow camelCase for TSX components.

## Knowledge & Standards
- **API Calls:** Frontend should use the defined `coreApiBase` and `regApiBase` libs for consistency.
- **Database:** Prisma is used in `apps/web` for direct DB reads if applicable, but SQLAlchemy is the primary for `core-svc`.
- **Ignore:** Do not suggest modifications to `node_modules`, `.next`, or `__pycache__`.