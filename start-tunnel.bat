@echo off
setlocal
title Cloudflare Tunnel - Expose Local Backend (Port 3001)
echo ========================================================
echo   Cloudflare Tunnel for DevToolkit Backend (Port 3001)
echo ========================================================
echo.

set "CF_EXE=cloudflared"
where cloudflared >nul 2>nul
if %errorlevel% neq 0 (
    if exist "C:\Program Files (x86)\cloudflared\cloudflared.exe" (
        set "CF_EXE=C:\Program Files (x86)\cloudflared\cloudflared.exe"
    ) else if exist "C:\Program Files\cloudflared\cloudflared.exe" (
        set "CF_EXE=C:\Program Files\cloudflared\cloudflared.exe"
    ) else (
        echo [!] Dang cai dat cloudflared qua winget...
        winget install Cloudflare.cloudflared --accept-package-agreements --accept-source-agreements
        set "CF_EXE=C:\Program Files (x86)\cloudflared\cloudflared.exe"
    )
)

echo Dang khoi dong Cloudflare Tunnel cho port 3001...
echo ========================================================
echo BAN HAY CHU Y:
echo Trong vai giay nua, man hinh se in ra 1 duong link dang:
echo    https://xxxx-xxxx-xxxx.trycloudflare.com
echo.
echo Hay COPY duong link do de dan vao trang Settings tren Web!
echo ========================================================
echo.
"%CF_EXE%" tunnel --url http://localhost:3001
pause
