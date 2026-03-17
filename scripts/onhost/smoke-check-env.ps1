# smoke-check-env.ps1
# Quick environment smoke test: shows key package versions and verifies imports.
# Run it from your repo root (after activating .venv)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Write-Host "=== LeadAI env smoke check ===" -ForegroundColor Cyan

# Ensure python is on PATH
try {
  $py = (Get-Command python -ErrorAction Stop).Source
  Write-Host "Python executable: $py" -ForegroundColor DarkCyan
} catch {
  Write-Host "ERROR: 'python' not found on PATH. Activate your venv first." -ForegroundColor Red
  exit 1
}

# ---- 1) Versions of key packages ----
Write-Host "`n[1/2] Package versions" -ForegroundColor Cyan
$code1 = @'
import sys, importlib.metadata as im

def v(pkg):
    try:
        return im.version(pkg)
    except Exception:
        return "n/a"

print("Python:", sys.version)
print("mcp:", v("mcp"))
print("anyio:", v("anyio"))
print("asyncpg:", v("asyncpg"))
print("psycopg:", v("psycopg"))
print("python-dotenv:", v("python-dotenv"))
'@

try {
  $out1 = $code1 | python - 2>&1
  $out1 | Write-Host
} catch {
  Write-Host "ERROR running package version check:" -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  exit 1
}

# ---- 2) Import checks for your package/modules ----
Write-Host "`n[2/2] Import checks (app, score_engine, app_db)" -ForegroundColor Cyan
$code2 = @'
import app, importlib.util
print("app ->", app.__file__)
import app.score_engine, app.app_db
print("score_engine OK:", hasattr(app.score_engine, "compute_kpi_scores"))
print("app_db OK:", hasattr(app.app_db, "init_pool"))
'@

$ok = $true
try {
  $out2 = $code2 | python - 2>&1
  $out2 | Write-Host
  if ($out2 -match 'MISSING' -or $out2 -match 'False') {
    $ok = $false
  }
} catch {
  Write-Host "ERROR running import checks:" -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  exit 1
}

Write-Host "`n=== Result ===" -ForegroundColor Cyan
if ($ok) {
  Write-Host "Smoke check: OK ✅" -ForegroundColor Green
  exit 0
} else {
  Write-Host "Smoke check: issues detected ❌ (see output above)" -ForegroundColor Yellow
  exit 2
}
