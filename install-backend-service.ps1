# DevToolkit Backend Windows Service Installer
#Requires -RunAsAdministrator

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  Cai dat DevToolkit Backend chay ngam Windows Service   " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

$baseDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$nssmPath = Join-Path $baseDir "devtoolkit\scripts\nssm.exe"
$backendDir = Join-Path $baseDir "devtoolkit\backend"
$entryPoint = Join-Path $backendDir "dist\index.js"
$nodePath = "C:\Program Files\nodejs\node.exe"

if (-not (Test-Path $nodePath)) {
    $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
    if ($nodeCmd) { $nodePath = $nodeCmd.Source }
}

Write-Host "[1/4] Kiem tra Node va dist/index.js..." -ForegroundColor Yellow
if (-not (Test-Path $entryPoint)) {
    Write-Host "Build backend truoc khi cai service..."
    Set-Location $backendDir
    npm run build
}

Write-Host "[2/4] Giai phong port 3001..." -ForegroundColor Yellow
$active3001 = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
foreach ($pidToKill in $active3001) {
    if ($pidToKill -and $pidToKill -gt 0) {
        Write-Host "  Tat tien trinh PID $pidToKill dang chiem port 3001..."
        Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "[3/4] Dang ky Windows Service: DevToolkitBackend ..." -ForegroundColor Yellow
& $nssmPath stop DevToolkitBackend 2>$null
& $nssmPath remove DevToolkitBackend confirm 2>$null

& $nssmPath install DevToolkitBackend $nodePath $entryPoint
& $nssmPath set DevToolkitBackend AppDirectory $backendDir
& $nssmPath set DevToolkitBackend DisplayName "DevToolkit Private Backend Service"
& $nssmPath set DevToolkitBackend Description "DevToolkit Local Express API and SQLite on Port 3001"
& $nssmPath set DevToolkitBackend Start SERVICE_AUTO_START
& $nssmPath set DevToolkitBackend AppStdout "$backendDir\service-stdout.log"
& $nssmPath set DevToolkitBackend AppStderr "$backendDir\service-stderr.log"

Write-Host "[4/4] Khoi dong Service..." -ForegroundColor Yellow
& $nssmPath start DevToolkitBackend

Start-Sleep -Seconds 2

Write-Host ""
Write-Host "========================================================" -ForegroundColor Green
Write-Host "  Trang thai Service sau khi dang ky:" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
Get-Service DevToolkitBackend -ErrorAction SilentlyContinue | Format-Table -AutoSize
sc.exe query DevToolkitBackend

Write-Host ""
Write-Host "HOAN TAT! Nhan Enter de ket thuc." -ForegroundColor Green
Read-Host
