# start_all.ps1
# LeadAI full-stack starter for Windows (ASCII-only)
# -----------------------------------------------------------------------------
# This script starts all runtime components in separate terminals.
# It first calls pre_startup.ps1 (checks only; does not start services).
# Components:
#   - Docker Desktop (ensure running)
#   - Qdrant container (qdrant_instance)
#   - PostgreSQL container (leadai_pg) [optional; starts if absent]
#   - Ollama (ollama serve) if not already listening on :11434
#   - FastAPI core service (apps\core-svc -> uvicorn :8001)
#   - MCP+Express backend (apps\mcp -> :8787)
#   - Next.js web (apps\web -> :3000)
# -----------------------------------------------------------------------------

param(
  [switch]$SkipPrecheck,
  [switch]$SkipPostgres,
  [int]$BackendPort  = 8787,
  [int]$FrontendPort = 3000,
  [int]$QdrantPort   = 6333,
  [int]$QdrantGrpc   = 6334,
  [int]$OllamaPort   = 11434,
  [int]$CoreSvcPort  = 8001,
  [int]$PgPort       = 5432,
  [string]$Collection = "leadai_docs",
  [string]$ProjectRoot = "C:\apps\_TheLeadAI",
  [string]$CoreSvcDir  = "C:\apps\_TheLeadAI\apps\core-svc"
)

$ErrorActionPreference = "Stop"

# --- Helpers ------------------------------------------------------------------
function Say($t){ Write-Host $t -ForegroundColor Cyan }
function Ok($t){ Write-Host "[OK]   $t" -ForegroundColor Green }
function Warn($t){ Write-Host "[WARN] $t" -ForegroundColor Yellow }
function Err($t){ Write-Host "[ERR]  $t" -ForegroundColor Red }

function Port-Listening([int]$port){
  try {
    $c = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction Stop
    return [bool]$c
  } catch {
    $line = netstat -ano | Select-String -Pattern ("LISTENING\s+" + $port + "\b")
    return [bool]$line
  }
}

function Ensure-DockerDesktop {
  try {
    docker info | Out-Null
    Ok "Docker reachable"
    return
  } catch {
    Warn "Docker not reachable; trying to start Docker Desktop..."
    $dockerApp = "${env:ProgramFiles}\Docker\Docker\Docker Desktop.exe"
    if (-not (Test-Path $dockerApp)) {
      Err "Docker Desktop not found at: $dockerApp"
      throw "Install Docker Desktop first."
    }
    Start-Process -FilePath $dockerApp | Out-Null
    # Wait until docker responds or timeout ~90s
    $deadline = (Get-Date).AddSeconds(90)
    do {
      Start-Sleep -Seconds 3
      try { docker info | Out-Null; Ok "Docker started"; return } catch { }
    } while ((Get-Date) -lt $deadline)
    throw "Docker did not become ready in time."
  }
}

# Create volume if missing (idempotent)
function Ensure-DockerVolume($name) {
  try {
    $exists = docker volume inspect $name 2>$null
    if ($LASTEXITCODE -eq 0) { Ok "Docker volume '$name' present" }
    else {
      Say "Creating Docker volume '$name'..."
      docker volume create $name | Out-Null
      Ok "Docker volume '$name' created"
    }
  } catch {
    Warn "Could not verify/create volume '$name': $($_.Exception.Message)"
  }
}

function Ensure-QdrantContainer {
  # Soft ports (warn if busy, skip container start)
  $qdrantHttpBusy = Port-Listening -port $QdrantPort
  $qdrantGrpcBusy = Port-Listening -port $QdrantGrpc

  if ($qdrantHttpBusy -or $qdrantGrpcBusy) {
    if ($qdrantHttpBusy) { Warn "Port $QdrantPort already in use -> Qdrant may already be running" }
    if ($qdrantGrpcBusy) { Warn "Port $QdrantGrpc already in use -> Qdrant gRPC may already be running" }
    Warn "Skipping Qdrant container start because one or both ports are busy."
    return
  }

  # Requires Docker to be running
  Ensure-DockerVolume "qdrant-storage"

  $exists = docker ps -a --format "{{.Names}}" | Select-String -Quiet -Pattern "^qdrant_instance$"
  if (-not $exists) {
    Say "Creating qdrant_instance..."
    docker run -d --name qdrant_instance `
      -p ${QdrantPort}:6333 -p ${QdrantGrpc}:6334 `
      -v qdrant-storage:/qdrant/storage `
      qdrant/qdrant | Out-Null
    Ok "qdrant_instance created"
  } else {
    $running = docker ps --format "{{.Names}}" | Select-String -Quiet -Pattern "^qdrant_instance$"
    if (-not $running) {
      Say "Starting qdrant_instance..."
      docker start qdrant_instance | Out-Null
      Ok "qdrant_instance started"
    } else {
      Ok "qdrant_instance already running"
    }
  }
}

function Ensure-PostgresContainer {
  if ($SkipPostgres) { Warn "Skipping PostgreSQL container as requested."; return }

  # If port is busy, assume Postgres is already running somewhere and skip starting container
  if (Port-Listening -port $PgPort) {
    Warn "Port $PgPort already in use -> PostgreSQL may already be running; skipping Docker start"
    return
  }

  $exists = docker ps -a --format "{{.Names}}" | Select-String -Quiet -Pattern "^leadai_pg$"
  if (-not $exists) {
    Say "Creating leadai_pg (PostgreSQL)..."
    docker run -d --name leadai_pg `
      -e POSTGRES_USER=leadai -e POSTGRES_PASSWORD=leadai -e POSTGRES_DB=leadai `
      -p ${PgPort}:5432 `
      -v leadai_pg_data:/var/lib/postgresql/data `
      postgres:16 | Out-Null
    Ok "leadai_pg created"
  } else {
    $running = docker ps --format "{{.Names}}" | Select-String -Quiet -Pattern "^leadai_pg$"
    if (-not $running) {
      Say "Starting leadai_pg..."
      docker start leadai_pg | Out-Null
      Ok "leadai_pg started"
    } else {
      Ok "leadai_pg already running"
    }
  }
}

function Ensure-Ollama {
  # Soft port: if busy, assume service already running
  if (Port-Listening -port $OllamaPort) {
    Warn "Port $OllamaPort already in use -> Ollama may already be running"
    Ok "Ollama already listening on :$OllamaPort"
    return
  }
  Warn "Ollama not listening on :$OllamaPort; starting 'ollama serve' in a new window..."
  $cmd = "cd `"$ProjectRoot`"; ollama serve"
  Start-Process powershell -ArgumentList "-NoExit","-Command",$cmd | Out-Null
  # Give it a few seconds to spin up
  Start-Sleep -Seconds 5
  if (Port-Listening -port $OllamaPort) {
    Ok "Ollama is now listening on :$OllamaPort"
  } else {
    Warn "Ollama may still be initializing..."
  }
}

function Open-Tab($title, $command, $workDir = $ProjectRoot) {
  # Use Windows Terminal if available; fallback to PowerShell
  $wt = "$env:LocalAppData\Microsoft\WindowsApps\wt.exe"
  if (Test-Path $wt) {
    Start-Process $wt -ArgumentList @("new-tab","-d", "$workDir", "powershell","-NoExit","-Command",$command,";","set","title $title") | Out-Null
  } else {
    Start-Process powershell -WorkingDirectory $workDir -ArgumentList "-NoExit","-Command",$command | Out-Null
  }
}

# --- 1) Pre-checks ------------------------------------------------------------
if (-not $SkipPrecheck) {
  $pre = Join-Path $ProjectRoot "scripts\pre_startup.ps1"
  if (-not (Test-Path $pre)) { Err "Missing $pre"; throw "Add pre_startup.ps1 first." }
  Say "Running pre_startup.ps1 checks (no services are started by it)..."
  & $pre
  if ($LASTEXITCODE -ne 0) {
    Err "Pre-startup found blocking issues. Fix them and re-run."
    exit 1
  }
  Ok "Pre-startup checks passed"
} else {
  Warn "Skipping pre_startup checks as requested."
}

# --- 2) Ensure Docker and containers -----------------------------------------
Say "Ensuring Docker Desktop is running..."
Ensure-DockerDesktop

Say "Ensuring Qdrant container is running..."
Ensure-QdrantContainer

Say "Ensuring PostgreSQL container is running (optional)..."
Ensure-PostgresContainer

# --- 3) Ensure Ollama ---------------------------------------------------------
Say "Ensuring Ollama is serving on :$OllamaPort..."
Ensure-Ollama

# --- 4) Launch app processes in separate terminals ---------------------------
# Check hard ports first (fail fast to avoid half-launched stack)
$hardPorts = @(
  @{ Port = $BackendPort; Label = "MCP+Express backend" },
  @{ Port = $FrontendPort; Label = "Next.js web" },
  @{ Port = $CoreSvcPort; Label = "FastAPI core service" },
  @{ Port = $PgPort; Label = "PostgreSQL" }
)
foreach($hp in $hardPorts){
  if (Port-Listening -port $hp.Port) {
    Err ("Port {0} already in use -> {1} cannot be started" -f $hp.Port, $hp.Label)
    exit 1
  }
}

# Set envs common to multiple processes (frontend uses NEXT_PUBLIC_ var)
$env:OLLAMA_URL = "http://localhost:$OllamaPort"
$env:QDRANT_URL = "http://localhost:$QdrantPort"
$env:QDRANT_COLLECTION = $Collection
$env:MCP_SERVER_URL = "http://localhost:$BackendPort"
$env:NEXT_PUBLIC_MCP_SERVER_URL = "http://localhost:$BackendPort"
$env:DATABASE_URL = "postgresql://leadai:leadai@localhost:$PgPort/leadai"

# Core service (FastAPI) -------------------------------------------------------
if (Test-Path $CoreSvcDir) {
  Say "Starting FastAPI core service (uvicorn) on :$CoreSvcPort..."
  $coreCmd = @"
cd "$CoreSvcDir"
if (Test-Path .\.venv\Scripts\activate) { . .\.venv\Scripts\activate }
set DATABASE_URL=$env:DATABASE_URL
uvicorn app.main:app --reload --host 0.0.0.0 --port $CoreSvcPort
"@
  Open-Tab -title "LeadAI CoreSvc" -command $coreCmd -workDir $CoreSvcDir
} else {
  Warn "Core service folder not found: $CoreSvcDir (skipping)"
}

# MCP + Express backend on 8787 ------------------------------------------------
Say "Starting MCP+Express backend on :$BackendPort..."
$backCmd = @"
cd "$ProjectRoot"
`$env:PORT="$BackendPort"
`$env:OLLAMA_URL="$env:OLLAMA_URL"
`$env:QDRANT_URL="$env:QDRANT_URL"
`$env:QDRANT_COLLECTION="$env:QDRANT_COLLECTION"
pnpm --filter ./apps/mcp dev
"@
Open-Tab -title "LeadAI MCP+Express" -command $backCmd

# Next.js web on 3000 ----------------------------------------------------------
Say "Starting Next.js web on :$FrontendPort..."
$webCmd = @"
cd "$ProjectRoot"
`$env:NEXT_PUBLIC_MCP_SERVER_URL="$env:NEXT_PUBLIC_MCP_SERVER_URL"
pnpm --filter ./apps/web dev --port $FrontendPort
"@
Open-Tab -title "LeadAI Web" -command $webCmd

# --- 5) Final info ------------------------------------------------------------
Write-Host ""
Ok "All components launched (in separate terminals)."
Write-Host "Health URLs:"
Write-Host (" - Backend:  http://localhost:" + $BackendPort + "/health")
Write-Host (" - Qdrant:   http://localhost:" + $QdrantPort)
Write-Host (" - CoreSvc:  http://localhost:" + $CoreSvcPort + "/health  (if implemented)")
Write-Host (" - Next.js:  http://localhost:" + $FrontendPort)
Write-Host (" - MCP tool: http://localhost:" + $BackendPort + "/tools/admin.status")
Write-Host ""
Write-Host "Notes:"
Write-Host (" - If port " + $OllamaPort + " is already in use, Ollama may already be running.")
Write-Host (" - If ports " + $QdrantPort + "/" + $QdrantGrpc + " are already in use, Qdrant may already be running.")
Write-Host "Use Ctrl+C in each window to stop, or close the windows."
