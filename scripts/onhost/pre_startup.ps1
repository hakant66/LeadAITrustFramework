# pre_startup.ps1
# LeadAI pre-startup validator for Windows (ASCII-only; PS5+ compatible)
# -----------------------------------------------------------------------------
# IMPORTANT:
# - This script checks only and it will not start services.
# - For your current setup, Qdrant runs in Docker, so Docker must be running for Qdrant.
# -----------------------------------------------------------------------------

param(
  [int]$BackendPort  = 8787,
  [int]$FrontendPort = 3000,
  [int]$QdrantPort   = 6333,
  [int]$QdrantGrpc   = 6334,
  [int]$OllamaPort   = 11434,
  [int]$CoreSvcPort  = 8001,
  [int]$PgPort       = 5432,
  [string]$Collection = "leadai_docs",
  [string]$CoreSvcDir = "C:\apps\_TheLeadAI\apps\core-svc"
)

# Banner must come after param
Write-Host "==============================================================="
Write-Host " LeadAI Pre-Startup Checks"
Write-Host " NOTE: This script checks only and it will not start services."
Write-Host "       Qdrant is configured to run via Docker; Docker must be running."
Write-Host "==============================================================="

# Script starts here ...
$ErrorActionPreference = "Stop"
$overallOk = $true
$issues = @()

function Write-Head($t){ Write-Host "" ; Write-Host "=== $t ===" -ForegroundColor Cyan }
function Write-OK($t){ Write-Host "[OK]   $t" -ForegroundColor Green }
function Write-Warn($t){ Write-Host "[WARN] $t" -ForegroundColor Yellow }
function Write-Bad($t){ Write-Host "[ERR]  $t" -ForegroundColor Red }

function Test-Command($name){
  try { return [bool](Get-Command $name -ErrorAction Stop) } catch { return $false }
}

function Test-Port([int]$port){
  try {
    $conns = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction Stop
    if ($conns) {
      $pids = $conns | Select-Object -ExpandProperty OwningProcess -Unique
      return @{ Used = $true; Pids = $pids }
    } else {
      return @{ Used = $false; Pids = @() }
    }
  } catch {
    # Fallback to netstat on older shells or restricted systems
    $lines = netstat -ano | Select-String -Pattern ("LISTENING\s+" + $port + "\b")
    if ($lines) {
      $pid = ($lines -split '\s+')[-1]
      return @{ Used = $true; Pids = @($pid) }
    }
    return @{ Used = $false; Pids = @() }
  }
}

function Test-Http($url){
  try {
    $r = Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 5
    return @{ Ok = $true; Status = $r.StatusCode; Body = $r.Content }
  } catch {
    return @{ Ok = $false; Error = $_.Exception.Message }
  }
}

function Check-Dependency($label, $ok){
  if ($ok) { Write-OK "$label found" } else { Write-Bad "$label missing"; $script:overallOk = $false; $script:issues += "$label missing" }
}

# Safe env getter for dynamic names (avoids $env:$name)
function Get-Env([string]$name, $fallback = $null){
  $v = [System.Environment]::GetEnvironmentVariable($name, "Process")
  if ([string]::IsNullOrEmpty($v)) { $v = [System.Environment]::GetEnvironmentVariable($name, "User") }
  if ([string]::IsNullOrEmpty($v)) { $v = [System.Environment]::GetEnvironmentVariable($name, "Machine") }
  if ([string]::IsNullOrEmpty($v)) { return $fallback }
  return $v
}

Write-Head "Environment"
$OLLAMA_URL = Get-Env "OLLAMA_URL" ("http://localhost:" + $OllamaPort)
$QDRANT_URL = Get-Env "QDRANT_URL" ("http://localhost:" + $QdrantPort)
$MCP_SERVER_URL = Get-Env "MCP_SERVER_URL" ("http://localhost:" + $BackendPort)
$NEXT_PUBLIC_MCP_SERVER_URL = Get-Env "NEXT_PUBLIC_MCP_SERVER_URL" ("http://localhost:" + $BackendPort)
$EMB_MODEL = Get-Env "EMB_MODEL" "nomic-embed-text"
$CHAT_MODEL = Get-Env "CHAT_MODEL" "llama3.1:8b"
$DATABASE_URL = Get-Env "DATABASE_URL" ("postgresql://leadai:leadai@localhost:" + $PgPort + "/leadai")

Write-Host ("OLLAMA_URL=" + $OLLAMA_URL)
Write-Host ("QDRANT_URL=" + $QDRANT_URL)
Write-Host ("MCP_SERVER_URL=" + $MCP_SERVER_URL)
Write-Host ("NEXT_PUBLIC_MCP_SERVER_URL=" + $NEXT_PUBLIC_MCP_SERVER_URL)
Write-Host ("EMB_MODEL=" + $EMB_MODEL)
Write-Host ("CHAT_MODEL=" + $CHAT_MODEL)
Write-Host ("DATABASE_URL=" + $DATABASE_URL)

Write-Head "Dependencies"
$nodeVersionOk = $false
if (Test-Command node) {
  try {
    $vtxt = node -v
    $v = ($vtxt -replace '[^\d\.]') -as [version]
    if ($v.Major -ge 20) { $nodeVersionOk = $true }
  } catch { $nodeVersionOk = $false }
}

if ($PSVersionTable.PSVersion.Major -ge 7) {
  Write-OK "PowerShell 7+ present"
} else {
  Write-Warn "PowerShell 7+ not found (optional). You are running Windows PowerShell $($PSVersionTable.PSVersion)."
}

Check-Dependency "Node.js (>= 20)" $nodeVersionOk
Check-Dependency "pnpm" (Test-Command pnpm)
Check-Dependency "Python (>= 3.10)" (Test-Command python)
Check-Dependency "Docker" (Test-Command docker)
Check-Dependency "Ollama" (Test-Command ollama)

Write-Head "Ports in use"
# Treat Qdrant (6333/6334) and Ollama (11434) as soft ports: WARN if used (service may already be running)
$softPorts = @($QdrantPort, $QdrantGrpc, $OllamaPort)

$ports = @($QdrantPort, $QdrantGrpc, $OllamaPort, $BackendPort, $FrontendPort, $CoreSvcPort, $PgPort)
foreach($p in $ports){
  $r = Test-Port $p
  if($r.Used){
    $pidList = ($r.Pids -join ', ')
    $msg = "Port $p is already in use (PID(s): $pidList)"

    if ($softPorts -contains $p) {
      # WARN for expected/benign cases (service may already be running).
      Write-Warn $msg
      if ($p -eq $OllamaPort) {
        Write-Host "      -> ollama could be already running at port $OllamaPort" -ForegroundColor Yellow
      }
      if ($p -eq $QdrantPort) {
        Write-Host "      -> Qdrant could be already running at port $QdrantPort" -ForegroundColor Yellow
      }
      if ($p -eq $QdrantGrpc) {
        Write-Host "      -> Qdrant could be already running at port $QdrantGrpc" -ForegroundColor Yellow
      }
      # Do NOT mark overallOk false for soft ports
    } else {
      # Hard error for everything else.
      $overallOk = $false
      $issues += $msg
      Write-Bad $msg
    }
  } else {
    Write-OK ("Port " + $p + " is free")
  }
}

Write-Head "Docker / Qdrant"
# Is qdrant_instance running?
try {
  $running = (docker ps --format "{{.Names}}" | Select-String -Quiet -Pattern "^qdrant_instance$")
  if($running){ Write-OK "qdrant_instance container running" } else { Write-Warn "qdrant_instance not running (start or create it)" }
} catch {
  Write-Warn ("Docker not reachable: " + $_.Exception.Message)
}

# REQUIRED: qdrant-storage volume must exist
try {
  docker volume inspect qdrant-storage | Out-Null
  if ($LASTEXITCODE -eq 0) {
    Write-OK "Docker volume 'qdrant-storage' exists"
  } else {
    Write-Bad "Docker volume 'qdrant-storage' does not exist"
    $overallOk = $false
    $issues += "Create it with: docker volume create qdrant-storage"
  }
} catch {
  Write-Bad "Failed to inspect Docker volume 'qdrant-storage' (is Docker Desktop running?)"
  $overallOk = $false
  $issues += "Ensure Docker is running, then create the volume: docker volume create qdrant-storage"
}

# Qdrant HTTP reachability
$qh = Test-Http "$QDRANT_URL"
if($qh.Ok){
  Write-OK ("Qdrant reachable (" + $qh.Status + ")")
} else {
  $overallOk = $false; $issues += ("Qdrant not reachable at " + $QDRANT_URL)
  Write-Bad ("Qdrant not reachable: " + $qh.Error)
}

# Qdrant collection existence
$qc = Test-Http ($QDRANT_URL + "/collections/" + $Collection)
if($qc.Ok){ Write-OK ("Collection '" + $Collection + "' exists") } else { Write-Warn ("Collection '" + $Collection + "' missing (will be created on first ingest)") }

Write-Head "Ollama"
$ov = Test-Http ($OLLAMA_URL + "/api/version")
if($ov.Ok){ Write-OK "Ollama reachable" } else { $overallOk = $false; $issues += ("Ollama not reachable at " + $OLLAMA_URL); Write-Bad ("Ollama not reachable: " + $ov.Error) }

try {
  $list = (ollama list) -join "`n"
  if($list -match [regex]::Escape($EMB_MODEL)){ Write-OK ("Embedding model '" + $EMB_MODEL + "' present") } else { Write-Bad ("Embedding model '" + $EMB_MODEL + "' NOT pulled"); $overallOk = $false; $issues += ("Pull model: ollama pull " + $EMB_MODEL) }
  if($list -match [regex]::Escape($CHAT_MODEL)){ Write-OK ("Chat model '" + $CHAT_MODEL + "' present") } else { Write-Bad ("Chat model '" + $CHAT_MODEL + "' NOT pulled"); $overallOk = $false; $issues += ("Pull model: ollama pull " + $CHAT_MODEL) }
} catch {
  Write-Warn ("Could not list Ollama models: " + $_.Exception.Message)
}

try {
  $emb = Invoke-RestMethod -Method Post -Uri ($OLLAMA_URL + "/api/embeddings") -ContentType "application/json" -Body (@{model=$EMB_MODEL; prompt="hello"} | ConvertTo-Json)
  if($emb.embedding -and $emb.embedding.Count -gt 0){ Write-OK ("Embeddings API OK (dim=" + $emb.embedding.Count + ")") } else { Write-Bad "Embeddings API returned empty vector"; $overallOk = $false; $issues += "Ollama embeddings returned empty vector" }
} catch {
  Write-Bad ("Embeddings API error: " + $_.Exception.Message); $overallOk = $false; $issues += "Ollama embeddings error"
}

# -------------------------
# UPDATED SECTION STARTS ↑
# -------------------------
Write-Head "FastAPI core service"
if(Test-Path $CoreSvcDir){
  Write-OK ("Core service folder exists (" + $CoreSvcDir + ")")
} else {
  Write-Bad ("Core service folder missing (" + $CoreSvcDir + ")")
  $overallOk = $false
  $issues += "Core service folder missing"
}

$coreBase = "http://localhost:$CoreSvcPort"
$coreUrls = @("$coreBase/health", "$coreBase/docs", "$coreBase/")
$hit = $null
foreach($u in $coreUrls){
  $r = Test-Http $u
  if($r.Ok){
    $hit = @{ Url = $u; Resp = $r }
    break
  }
}

if($hit){
  Write-OK ("Core service reachable at {0} ({1})" -f $hit.Url, $hit.Resp.Status)
} else {
  Write-Warn ("Core service not responding at any of: {0}" -f ($coreUrls -join ", "))
}
# -------------------------
# UPDATED SECTION ENDS   ↓
# -------------------------

Write-Head "MCP+Express backend"
$bh = Test-Http ("http://localhost:" + $BackendPort + "/health")
if($bh.Ok){ Write-OK "Backend /health OK" } else { Write-Warn ("Backend not running on :" + $BackendPort) }
$bs = Test-Http ("http://localhost:" + $BackendPort + "/tools/admin.status")
if($bs.Ok){ Write-OK "Backend /tools/admin.status reachable" } else { Write-Warn "Backend tool route not responding" }

Write-Head "Next.js proxy"
$nh = Test-Http ("http://localhost:" + $FrontendPort + "/api/tools/admin.status")
if($nh.Ok){ Write-OK "Next.js /api/tools/admin.status reachable" } else { Write-Warn ("Next.js not running on :" + $FrontendPort) }

Write-Head "Summary"
if($overallOk){
  Write-OK "Pre-startup checks passed. You can start components."
  exit 0
} else {
  Write-Bad "Pre-startup checks found issues:"
  $issues | ForEach-Object { Write-Host (" - " + $_) -ForegroundColor Red }
  exit 1
}
