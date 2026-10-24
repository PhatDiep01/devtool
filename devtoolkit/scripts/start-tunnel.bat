@echo off
echo Starting Cloudflare Tunnel...
echo Make sure cloudflared is installed: winget install Cloudflare.cloudflared
echo.
echo Option 1: Quick tunnel (no domain needed, temporary URL):
echo   cloudflared tunnel --url http://localhost:3001
echo.
echo Option 2: Named tunnel (requires Cloudflare account + domain):
echo   cloudflared tunnel run devtoolkit
echo.
echo Starting quick tunnel...
cloudflared tunnel --url http://localhost:3001
