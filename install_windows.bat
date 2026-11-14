@echo off
setlocal
cd /d "%~dp0"
echo ==========================================
echo VEGA CRM ^& ERP - Windows Local Setup
echo ==========================================
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install Node.js 20 LTS from https://nodejs.org/
  pause
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo npm was not found. Reinstall Node.js 20 LTS.
  pause
  exit /b 1
)
if not exist ".env.local" (
  copy ".env.example" ".env.local" >nul
  echo Created .env.local from .env.example.
  echo Edit it and add your Supabase project URL and anon key before continuing.
  notepad ".env.local"
)
echo Installing node packages...
call npm install
if errorlevel 1 (
  echo npm install failed. Please copy the error and share it.
  pause
  exit /b 1
)
echo.
echo Start local development server now? [Y/N]
choice /c YN /n
if errorlevel 2 exit /b 0
call npm run dev
