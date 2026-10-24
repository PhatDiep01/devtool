@echo off
setlocal EnableDelayedExpansion
title Cai dat DevToolkit Backend Windows Service
echo ========================================================
echo   Cai dat DevToolkit Backend chay ngam Windows Service
echo ========================================================
echo.

:: 1. Kiem tra quyen Administrator
net session >nul 2>&1
if errorlevel 1 (
    echo Dang yeu cau quyen Administrator qua UAC...
    echo Vui long bam YES tren hop thoai Windows hien len.
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

:: 2. Thiet lap duong dan tuyet doi
cd /d "%~dp0"
set "NSSM=%~dp0devtoolkit\scripts\nssm.exe"
set "NODE_EXE=C:\Program Files\nodejs\node.exe"
set "BACKEND_DIR=%~dp0devtoolkit\backend"
set "APP_ENTRY=%~dp0devtoolkit\backend\dist\index.js"

echo [1/4] Kiem tra moi truong Node.js va Backend...
if not exist "%NODE_EXE%" (
    for /f "delims=" %%I in ('where node.exe 2^>nul') do set "NODE_EXE=%%I"
)
echo       Node.js path: "%NODE_EXE%"

if not exist "%APP_ENTRY%" (
    echo [!] Chua thay file dist\index.js, tien hanh build backend...
    cd /d "%BACKEND_DIR%"
    call npm run build
    cd /d "%~dp0"
)

echo [2/4] Giai phong port 3001 neu dang co tien trinh chay...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001 ^| findstr LISTENING') do (
    echo       Tat PID %%a dang chiem port 3001...
    taskkill /F /PID %%a >nul 2>&1
)

echo [3/4] Dang ky Windows Service: DevToolkitBackend ...
"%NSSM%" stop DevToolkitBackend >nul 2>&1
"%NSSM%" remove DevToolkitBackend confirm >nul 2>&1

"%NSSM%" install DevToolkitBackend "%NODE_EXE%" "%APP_ENTRY%"
"%NSSM%" set DevToolkitBackend AppDirectory "%BACKEND_DIR%"
"%NSSM%" set DevToolkitBackend DisplayName "DevToolkit Private Backend Service"
"%NSSM%" set DevToolkitBackend Description "DevToolkit Local Express API and SQLite on Port 3001"
"%NSSM%" set DevToolkitBackend Start SERVICE_AUTO_START
"%NSSM%" set DevToolkitBackend AppStdout "%BACKEND_DIR%\service-stdout.log"
"%NSSM%" set DevToolkitBackend AppStderr "%BACKEND_DIR%\service-stderr.log"

echo [4/4] Khoi dong Service...
"%NSSM%" start DevToolkitBackend

echo.
echo ========================================================
echo   Kiem tra trang thai Service sau khi khoi dong:
echo ========================================================
"%NSSM%" status DevToolkitBackend
sc.exe query DevToolkitBackend

echo.
echo ========================================================
echo   HOAN TAT! DevToolkit Backend da duoc cai thanh Service!
echo   Trang thai: Chay ngam tu dong khi mo may tinh (Port 3001).
echo ========================================================
echo.
pause
