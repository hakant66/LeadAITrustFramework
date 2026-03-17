Write-Host "=== WSL Diagnostic Check ===" -ForegroundColor Cyan

# Check 1: Windows version
$os = (Get-WmiObject -Class Win32_OperatingSystem).Caption
Write-Host "OS: $os" -ForegroundColor Yellow

# Check 2: WSL command availability
Write-Host "`nChecking wsl command..." -ForegroundColor Yellow
try {
    wsl --status 2>&1 | Out-Null
    Write-Host "✓ wsl command available" -ForegroundColor Green
} catch {
    Write-Host "✗ wsl command not found" -ForegroundColor Red
}

# Check 3: Windows features
Write-Host "`nChecking Windows features..." -ForegroundColor Yellow
$wslFeature = Get-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-Subsystem-Linux -ErrorAction SilentlyContinue
$vmFeature = Get-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform -ErrorAction SilentlyContinue

if ($wslFeature) {
    Write-Host "WSL Feature State: $($wslFeature.State)" -ForegroundColor Green
} else {
    Write-Host "WSL Feature not found" -ForegroundColor Red
}

if ($vmFeature) {
    Write-Host "VM Platform State: $($vmFeature.State)" -ForegroundColor Green
}

# Check 4: Docker status
Write-Host "`nChecking Docker..." -ForegroundColor Yellow
$dockerProcess = Get-Process -Name "Docker Desktop" -ErrorAction SilentlyContinue
if ($dockerProcess) {
    Write-Host "✓ Docker Desktop is running" -ForegroundColor Green
} else {
    Write-Host "✗ Docker Desktop not running" -ForegroundColor Red
}

# Recommendations
Write-Host "`n=== Recommendations ===" -ForegroundColor Cyan
if (-not $wslFeature -or $wslFeature.State -ne "Enabled") {
    Write-Host "1. Run PowerShell as Administrator and execute:" -ForegroundColor Yellow
    Write-Host "   wsl --install" -ForegroundColor White
} else {
    Write-Host "1. WSL appears to be installed" -ForegroundColor Green
}

Write-Host "`n2. To manage Docker containers without WSL:" -ForegroundColor Yellow
Write-Host "   Right-click Docker tray icon → 'Switch to Windows containers'" -ForegroundColor White