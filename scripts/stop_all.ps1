# stop_all.ps1
# Best-effort stop of containers; app terminals can be closed manually.

$ErrorActionPreference = "SilentlyContinue"

Write-Host "Stopping Qdrant container..." -ForegroundColor Yellow
docker stop qdrant_instance | Out-Null

Write-Host "Stopping PostgreSQL container..." -ForegroundColor Yellow
docker stop leadai_pg | Out-Null

Write-Host "If Ollama was started in its own window via 'ollama serve', close that window."
Write-Host "Close the MCP+Express and Next.js windows to stop those apps."
Write-Host "Done."
