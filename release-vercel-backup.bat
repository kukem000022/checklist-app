@echo off
setlocal
cd /d "%~dp0"

for /f "delims=" %%B in ('git branch --show-current') do set "CURRENT_BRANCH=%%B"
if /i not "%CURRENT_BRANCH%"=="main" goto wrong_branch

git diff --cached --quiet
if errorlevel 1 goto staged_changes

echo [1/5] Checking frontend code...
call npm.cmd run lint
if errorlevel 1 goto check_failed

echo.
echo [2/5] Building the frontend...
call npm.cmd run build
if errorlevel 1 goto check_failed

echo.
echo [3/5] Checking backend syntax...
node --check backend/src/server.js
if errorlevel 1 goto check_failed

echo.
echo [4/5] Creating the Vercel backup commit...
git add -- .github/workflows/deploy-frontend.yml backend/src/server.js frontend/.env.example frontend/src/api.js TODO_CODEX.md release-vercel-backup.bat
if errorlevel 1 goto stage_failed

git diff --cached --quiet
if not errorlevel 1 goto push_release

git commit -m "Add Vercel API fallback"
if errorlevel 1 goto commit_failed

:push_release
echo.
echo [5/5] Pushing main to origin...
git push origin main
if errorlevel 1 goto push_failed

echo.
echo Vercel backup preparation pushed successfully.
pause
exit /b 0

:wrong_branch
echo This release must run from the main branch. Current branch: %CURRENT_BRANCH%
goto failed

:staged_changes
echo Staged changes already exist. Nothing was changed to avoid mixing commits.
goto failed

:check_failed
echo A code check failed. Nothing was committed or pushed.
goto failed

:stage_failed
echo Could not prepare the release files.
goto failed

:commit_failed
echo Commit failed. Nothing was pushed.
goto failed

:push_failed
echo Push failed. The commit is still available locally.

:failed
echo.
echo Review the message above and try again.
pause
exit /b 1
