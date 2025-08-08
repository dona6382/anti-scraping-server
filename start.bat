@echo off
echo 🚀 Anti-Scraping Server Quick Start
echo ====================================

REM Check if node_modules exists
if not exist "node_modules\" (
    echo 📦 Installing dependencies...
    call npm install
) else (
    echo ✅ Dependencies already installed
)

REM Check if .env exists
if not exist ".env" (
    echo 📋 Creating .env file from example...
    copy .env.example .env
    echo ✅ .env file created
) else (
    echo ✅ .env file exists
)

echo.
echo Starting development server...
echo ==============================
npm run start:dev
