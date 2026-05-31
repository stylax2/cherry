@echo off
:: Set current directory to the batch file's folder
cd /d "%~dp0"

echo =====================================================================
echo  Cherry Blossom WebGIS Service Startup Script
echo =====================================================================
echo.

:: Check if Python is available
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in the PATH.
    echo Please install Python and try again.
    pause
    exit /b 1
)

:: 1. Launch Backend FastAPI server in a new window
echo [1/3] Starting Backend API Server (Port 8000)...
cd /d "%~dp0backend"
start "Cherry Blossom GIS Backend" cmd /k "python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

:: 2. Launch Frontend HTTP server in a new window
echo [2/3] Starting Frontend Web Server (Port 8080)...
cd /d "%~dp0frontend"
start "Cherry Blossom GIS Frontend" cmd /k "python -m http.server 8080"

:: Restore directory to project root
cd /d "%~dp0"

:: 3. Wait for 3 seconds to ensure servers are up, then open browser
echo [3/3] Launching web browser...
ping 127.0.0.1 -n 4 >nul

:: Open the default web browser to the frontend
start http://localhost:8080/

echo.
echo =====================================================================
echo  Both servers started successfully!
echo.
echo  - Backend API:  http://127.0.0.1:8000/docs
echo  - Frontend App: http://localhost:8080/
echo.
echo  Keep the server windows open. You can close this window now.
echo =====================================================================
ping 127.0.0.1 -n 6 >nul
