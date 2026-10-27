@echo off
setlocal EnableDelayedExpansion
title Ket noi Du an Firebase (Firebase Setup)
echo ========================================================
echo   Ket noi Du an Firebase voi DevToolkit
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/3] Dang nhap tai khoan Google Firebase...
echo       Trinh duyet se mo ra de ban dang nhap tai khoan Google.
call npx firebase-tools login

echo.
echo [2/3] Danh sach cac du an Firebase tren tai khoan cua ban:
echo ========================================================
call npx firebase-tools projects:list
echo ========================================================
echo.

set /p PROJ_ID="Nhap chinh xac Project ID cua ban o danh sach tren: "

if "%PROJ_ID%"=="" (
    echo [!] Ban chua nhap Project ID!
    pause
    exit /b 1
)

echo.
echo [3/3] Lien ket du an: %PROJ_ID% ...
call npx firebase-tools use %PROJ_ID%

echo.
echo ========================================================
echo   THANH CONG! Da lien ket du an Firebase: %PROJ_ID%
echo   Bay gio ban co the click file "deploy-firebase.bat"
echo   de deploy website len Firebase bat cu luc nao!
echo ========================================================
echo.
pause
