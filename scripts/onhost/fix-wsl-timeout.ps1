Write-Host "=== Fixing WSL Timeout Error ===" -ForegroundColor Cyan

# 1. Stop Docker Desktop
Write-Host "Stopping Docker Desktop..." -ForegroundColor Yellow
Get-Process -Name "Docker Desktop", "com.docker.*" -ErrorAction SilentlyContinue | Stop-Process -Force
Stop-Service "com.docker.service" -Force -ErrorAction SilentlyContinue 2>$null

# 2. Shutdown WSL
Write-Host "Shutting down WSL..." -ForegroundColor Yellow
wsl --shutdown 2>$null
Start-Sleep -Seconds 5

# 3. Kill all WSL processes
Write-Host "Killing WSL processes..." -ForegroundColor Yellow
Get-Process -Name "wsl*", "vmwp*", "vmmem*" -ErrorAction SilentlyContinue | Stop-Process -Force 2>$null

# 4. Reset WSL
Write-Host "Resetting WSL distributions..." -ForegroundColor Yellow
wsl --list --quiet 2>$null | ForEach-Object {
    Write-Host "  Terminating: $_" -ForegroundColor Gray
    wsl --terminate $_ 2>$null
}

# 5. Create WSL config with longer timeout
Write-Host "Creating WSL config..." -ForegroundColor Yellow
$wslConfig = @"
[wsl2]
kernelCommandLine = vsyscall=emulate
memory=4GB
processors=4
localhostForwarding=true
"@
$wslConfig | Out-File "$env:USERPROFILE\.wslconfig" -Encoding UTF8

# 6. Network reset
Write-Host "Resetting network..." -ForegroundColor Yellow
netsh winsock reset 2>$null
ipconfig /flushdns 2>$null

# 7. Start Docker Desktop
Write-Host "Starting Docker Desktop..." -ForegroundColor Green
Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe" -Verb RunAs

# 8. Wait longer than usual
Write-Host "Waiting 60 seconds for Docker to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 60

# 9. Test
Write-Host "Testing Docker..." -ForegroundColor Cyan
docker version 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "Docker is working!" -ForegroundColor Green
} else {
    Write-Host "Docker still has issues" -ForegroundColor Red
}