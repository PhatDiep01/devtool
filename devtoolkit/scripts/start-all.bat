@echo off
echo ========================================
echo   DevToolkit - Starting All Services
echo ========================================
echo.

echo [1/3] Starting Backend API (port 3001)...
start "DevToolkit-Backend" cmd /k "cd /d %~dp0..\backend && npm run dev"

timeout /t 3 /nobreak > nul

echo [2/3] Starting Frontend Dev Server (port 5173)...
start "DevToolkit-Frontend" cmd /k "cd /d %~dp0..\frontend && npm run dev"

timeout /t 2 /nobreak > nul

echo [3/3] Starting Cloudflare Tunnel...
start "DevToolkit-Tunnel" cmd /k "cloudflared tunnel --url http://localhost:3001"

echo.
echo ========================================
echo   All services started!
echo   Backend:  http://localhost:3001
echo   Frontend: http://localhost:5173
echo   Tunnel:   Check tunnel window for URL
echo ========================================
pause
