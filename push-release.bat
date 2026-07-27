@echo off
setlocal
cd /d "%~dp0"

echo [1/2] Building the release...
call npm.cmd run build
if errorlevel 1 (
  echo.
  echo Build failed. Nothing was pushed.
  pause
  exit /b 1
)

echo.
echo [2/2] Pushing main to origin...
git push origin main
if errorlevel 1 (
  echo.
  echo Push failed. Review the message above and try again.
  pause
  exit /b 1
)

echo.
echo Release pushed successfully.
pause
