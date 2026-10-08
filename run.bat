@echo off
cd /d "%~dp0"
echo Starting Float Dot...
node scripts\start.cjs
if errorlevel 1 pause
