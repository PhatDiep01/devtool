@echo off
title Deploy DevToolkit Frontend to Firebase Hosting
echo ========================================================
echo   Deploy DevToolkit Frontend to Firebase Hosting
echo ========================================================
echo.

echo [1/2] Building Frontend SPA...
cd /d "%~dp0devtoolkit\frontend"
call npm run build

if %errorlevel% neq 0 (
    echo [X] Build Frontend that bai!
    pause
    exit /b 1
)

echo.
echo [2/2] Deploying to Firebase Hosting...
cd /d "%~dp0"
call npx firebase-tools deploy --only hosting

if %errorlevel% neq 0 (
    echo [!] Neu gap loi chua dang nhap, hay chay: npx firebase login
)

pause
