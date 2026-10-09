@echo off
cd /d "%~dp0"
echo Starting Float Dot (Live Dev Mode)...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [Notice] Node.js is not found in PATH.
    if exist "dist\Float Dot 0.1.0.exe" (
        echo Launching packaged portable app instead...
        start "" "dist\Float Dot 0.1.0.exe" %*
        exit /b 0
    )
    if exist "dist\win-unpacked\Float Dot.exe" (
        echo Launching unpacked app instead...
        start "" "dist\win-unpacked\Float Dot.exe" %*
        exit /b 0
    )
    echo Please install Node.js or run run-portable.bat.
    pause
    exit /b 1
)

node scripts\start.cjs %*
if errorlevel 1 pause
