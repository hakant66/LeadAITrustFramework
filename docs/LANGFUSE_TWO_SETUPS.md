# Langfuse (embedded)

Langfuse runs as part of the main stack for LLM observability.

- **Defined in:** `docker-compose.yml` (root)
- **Services:** `langfuse-web`, `langfuse-worker`, `langfuse-clickhouse`, `langfuse-redis`
- **Containers:** `leadai-langfuse-web`, `leadai-langfuse-worker`, etc.
- **UI:** http://localhost:4000 (mapped from container port 3000)
- **Data:** Same Postgres (database `langfuse`) and same MinIO (bucket `langfuse`) as the rest of LeadAI.

Start the stack (including Langfuse) from the repo root:

```bash
docker compose up -d
```

If port 4000 is already in use, stop whatever is bound there (e.g. another Docker project) or change the `langfuse-web` port in `docker-compose.yml` (e.g. `4001:3000`).
