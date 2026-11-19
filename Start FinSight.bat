@echo off
title FinSight
setlocal

REM ==========================================================================
REM  FinSight launcher - double-click to start the app and open your browser.
REM  Keep this window open while you use FinSight. Close it to stop the app.
REM ==========================================================================

REM --- Find Node.js (installed globally, or the portable copy used during setup)
where node >nul 2>nul
if errorlevel 1 (
  if exist "%LOCALAPPDATA%\node-portable\node-v24.22.3-win-x64\node.exe" (
    set "PATH=%LOCALAPPDATA%\node-portable\node-v24.22.3-win-x64;%PATH%"
  ) else (
    echo.
    echo  Node.js was not found. Install the LTS version from https://nodejs.org
    echo  and then double-click this file again.
    echo.
    pause
    exit /b 1
  )
)

cd /d "%~dp0"

REM --- First run: install dependencies
if not exist "node_modules" (
  echo Installing dependencies - first run only, this takes a few minutes...
  call npm install
  if errorlevel 1 goto :fail
)

REM --- First run: create the database and the demo account
if not exist "prisma\dev.db" (
  echo Setting up the database and demo data...
  call npx prisma migrate deploy
  if errorlevel 1 goto :fail
  call npx prisma db seed
  if errorlevel 1 goto :fail
)

REM --- Build the optimized production version if it doesn't exist yet
if not exist ".next\BUILD_ID" (
  echo Building FinSight - first run only, this takes 1-3 minutes...
  if exist ".next" rmdir /s /q ".next"
  call npx next build
  if errorlevel 1 goto :fail
)

REM --- Open the browser once the server is ready (runs in the background)
start "" /b powershell -NoProfile -WindowStyle Hidden -Command "for($i=0;$i -lt 90;$i++){try{Invoke-WebRequest -UseBasicParsing http://localhost:3000/login -TimeoutSec 2 | Out-Null; Start-Process 'http://localhost:3000'; break}catch{Start-Sleep -Seconds 1}}"

echo.
echo  ==============================================================
echo   FinSight is running at  http://localhost:3000
echo   Demo login:  demo@finsight.app  /  Demo@1234
echo   Keep this window open. Close it to stop FinSight.
echo  ==============================================================
echo.

REM Local http:// server, so session cookies must not require HTTPS
set INSECURE_COOKIES=1
call npx next start -p 3000
goto :eof

:fail
echo.
echo  Something went wrong during setup. Scroll up to see the error.
pause
exit /b 1
