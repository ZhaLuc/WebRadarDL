@echo off
cd /d "%~dp0"
if not exist "%~dp0WebRadarDL.exe" (
    echo WebRadarDL.exe not found. Build launcher\launcher.vcxproj from DL_WebRadar.sln
    pause
    exit /b 1
)
"%~dp0WebRadarDL.exe"
