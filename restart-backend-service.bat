@echo off
setlocal EnableDelayedExpansion
title Khoi dong lai DevToolkit Backend Windows Service
echo ========================================================
echo   Khoi dong lai DevToolkit Backend Windows Service
echo ========================================================
echo.

net session >nul 2>&1
if errorlevel 1 (
    echo Dang yeu cau quyen Administrator qua UAC de khoi dong lai service...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

set "NSSM=%~dp0devtoolkit\scripts\nssm.exe"
echo Dang restart service DevToolkitBackend...
"%NSSM%" restart DevToolkitBackend
echo.
echo ========================================================
echo [OK] Service DevToolkitBackend da duoc khoi dong lai thanh cong!
echo ========================================================
echo.
timeout /t 3 /nobreak >nul
