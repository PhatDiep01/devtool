@echo off
title DevToolkit - Unified Platform
echo ========================================================
echo   DevToolkit Unified Platform (Frontend + Backend)
echo   Chay duy nhat 1 site tren port 3001
echo ========================================================
echo.

if not exist "%~dp0devtoolkit\frontend\dist\index.html" (
    echo [1/2] Building Frontend SPA...
    cd /d "%~dp0devtoolkit\frontend"
    call npm run build
)

if not exist "%~dp0devtoolkit\backend\dist\index.js" (
    echo [2/2] Building Backend...
    cd /d "%~dp0devtoolkit\backend"
    call npm run build
)

echo.
echo Starting Unified Server on http://localhost:3001 ...
cd /d "%~dp0devtoolkit\backend"
start http://localhost:3001
node dist/index.js
