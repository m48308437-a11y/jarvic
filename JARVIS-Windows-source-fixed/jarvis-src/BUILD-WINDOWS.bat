@echo off
setlocal
cd /d "%~dp0"
echo [1/2] Installing dependencies...
call npm install
if errorlevel 1 goto error
echo [2/2] Building JARVIS portable EXE...
call npm run dist
if errorlevel 1 goto error
echo.
echo Build complete. Check the dist folder.
pause
exit /b 0
:error
echo.
echo Build failed. Review the error above.
pause
exit /b 1
