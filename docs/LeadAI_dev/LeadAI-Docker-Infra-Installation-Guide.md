# LeadAI – Docker Infra Installation Guide (Postgres, Redis, MinIO)

## 1) Overview
This guide explains how to install and operate the Docker-based infrastructure for the LeadAI laptop prototype. It covers what each component does, how they communicate, how they map to LeadAI modules, step-by-step installation on Windows, and common Docker commands.

## 2) What Each Piece Does
- **Postgres (Database)** — System of record for all structured/domain data: organisations, users, projects, controls, assessments (0–3), issues, certification states, autotest results, trust factsheets/marks metadata, and hash-chained audit logs.
- **Redis (Queue/Broker)** — Fast, ephemeral task broker for background jobs (Celery). Used for IP/license scans, provenance scoring, PDF generation, signing, and SLA reminders.
- **MinIO (Object Storage, S3-compatible)** — Stores evidence binaries and generated artifacts (scorecard PDFs, CSVs, factsheets). Only object URI + SHA256 is stored in Postgres.

## 3) How Services Communicate (Local Compose Network)
- **APIs/Workers → Postgres:** `postgres:5432` (DSN: `postgresql+psycopg://leadai:leadai@postgres:5432/leadai`)
- **APIs/Workers → Redis:** `redis:6379` (URL: `redis://redis:6379/0`)
- **APIs/Frontend → MinIO:** `http://minio:9000` from containers (`http://localhost:9000` from browser for presigned uploads/downloads)
- All services share an isolated Docker network and resolve each other by service name (`postgres`, `redis`, `minio`).

## 4) Mapping to LeadAI Modules
| Module / Feature              | Postgres | Redis (Queues) | MinIO (Objects) |
|---|---|---|---|
| **Compliance Scorecard** | Controls, assessments, weights, issues | — | Scorecard PDF/CSV |
| **Trust Certification Engine** | Certification FSM, autotests, findings | Autotest/sign/PDF jobs, reminders | Factsheet PDF |
| **IP & Data Integrity Audit** | Dataset/provenance, scan metadata | Scan jobs | Manifests/licenses |
| **Regulatory Alignment Hub** | Reg items, mappings, alerts | Alert scheduling | — |
| **TrustMark™ Registry** | TrustMark rows (ID, signature, status) | (Optional) anchor jobs | Badge/artifacts (optional) |
| **Evidence & Auditability** | Evidence rows (URI + SHA256), audit log chain | — | Evidence binaries |

## 5) Step-by-Step Installation (Windows 10/11 + Docker Desktop)

### A) Create a working folder and `docker-compose.yml`
Open **PowerShell**:

```powershell
New-Item -ItemType Directory -Path C:\leadai -Force | Out-Null
Set-Location C:\leadai
```

Create `docker-compose.yml` with:

```yaml
services:
  postgres:
    image: postgres:15
    container_name: leadai-postgres
    environment:
      POSTGRES_USER: leadai
      POSTGRES_PASSWORD: leadai
      POSTGRES_DB: leadai
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U leadai -d leadai"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7
    container_name: leadai-redis
    command: ["redis-server", "--save", "", "--appendonly", "no"]
    ports:
      - "6379:6379"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  minio:
    image: quay.io/minio/minio:latest
    container_name: leadai-minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9000:9000"   # S3 API
      - "9001:9001"   # Web console
    volumes:
      - minio:/data
    restart: unless-stopped

volumes:
  pgdata:
  minio:
```

### B) Start the stack
```powershell
docker compose up -d
docker compose ps
```

Expected: all three services show **Up** (health may be “starting” for ~10–20s).

### C) Quick health checks
**Postgres**
```powershell
docker exec -it leadai-postgres psql -U leadai -d leadai -c "SELECT version();"
```

**Redis**
```powershell
docker exec -it leadai-redis redis-cli PING
# Expect: PONG
```

**MinIO Console**
- Open http://localhost:9001  
- Login: `minioadmin / minioadmin`  
- Create bucket **`evidence`**.

## 6) Service Endpoints for Applications
From containers:
```
DATABASE_URL=postgresql+psycopg://leadai:leadai@postgres:5432/leadai
REDIS_URL=redis://redis:6379/0
S3_ENDPOINT=http://minio:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=evidence
S3_USE_SSL=false
```
From the browser (presigned uploads/downloads): `S3_ENDPOINT=http://localhost:9000`

## 7) Common Docker Commands

**Lifecycle**
```powershell
docker compose up -d
docker compose stop
docker compose down          # remove containers (keep volumes)
docker compose down -v       # remove containers AND volumes (wipes data)
```

**Status & Logs**
```powershell
docker compose ps
docker compose logs -f
docker compose logs postgres
```

**Exec into containers**
```powershell
docker exec -it leadai-postgres bash
docker exec -it leadai-redis sh
```

**Restart single service**
```powershell
docker compose restart minio
```

## 8) Troubleshooting

- **Port already in use**
  ```powershell
  netstat -ano | findstr :5432  # or :6379 / :9000 / :9001
  ```
  Change the host port mapping in `docker-compose.yml` or free the port.

- **Postgres auth fails after changing env**
  First run persists initial credentials. Reset volumes:
  ```powershell
  docker compose down -v
  docker compose up -d
  ```

- **MinIO console not loading**
  Use **http://localhost:9001** (console) not 9000 (API). Check logs:
  ```powershell
  docker compose logs minio
  ```

- **Redis ping error**
  Ensure the command is exactly:
  ```powershell
  docker exec -it leadai-redis redis-cli PING
  ```

## 9) Network & Communication Summary
```
[ Next.js / Browser ] --(HTTP, presigned PUT/GET)--> localhost:9000 (MinIO)
          |                                              ^
          v                                              |
[ FastAPI APIs ] --(TCP)--> postgres:5432 (Postgres)     |
          |           \--> redis:6379 (Redis)            |
          \----------------------------------------------/
              (APIs create presigned URLs & record metadata)
```
