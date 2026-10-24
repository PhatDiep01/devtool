@echo off
setlocal EnableDelayedExpansion
title Go bo DevToolkit Backend Windows Service
echo ========================================================
echo   Go bo DevToolkit Backend Windows Service
echo ========================================================
echo.

net session >nul 2>&1
if errorlevel 1 (
    echo Dang yeu cau quyen Administrator qua UAC...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

set "NSSM=%~dp0devtoolkit\scripts\nssm.exe"
echo Dang dung va go bo service DevToolkitBackend...
"%NSSM%" stop DevToolkitBackend >nul 2>&1
"%NSSM%" remove DevToolkitBackend confirm >nul 2>&1

echo.
echo ========================================================
echo   Da go bo thanh cong DevToolkitBackend khoi Windows Services!
echo ========================================================
echo.
pause
