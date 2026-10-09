@echo off
cd /d "%~dp0"
echo ====================================================
echo             Float Dot - Portable Launcher
echo ====================================================

if exist "dist\Float Dot 0.1.0.exe" (
    echo Launching portable standalone binary...
    start "" "dist\Float Dot 0.1.0.exe" %*
    exit /b 0
)

if exist "dist\win-unpacked\Float Dot.exe" (
    echo Launching unpacked binary...
    start "" "dist\win-unpacked\Float Dot.exe" %*
    exit /b 0
)

echo No packaged binary found in dist\. Building portable binary...
call npm run build:win
if exist "dist\Float Dot 0.1.0.exe" (
    start "" "dist\Float Dot 0.1.0.exe" %*
) else (
    echo Failed to find or build portable binary.
    pause
)
