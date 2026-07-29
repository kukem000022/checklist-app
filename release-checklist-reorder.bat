@echo off
setlocal
cd /d "%~dp0"

for /f "delims=" %%B in ('git branch --show-current') do set "CURRENT_BRANCH=%%B"
if /i not "%CURRENT_BRANCH%"=="main" goto wrong_branch

git diff --cached --quiet
if errorlevel 1 goto staged_changes

echo [1/4] Building the release...
call npm.cmd run build
if errorlevel 1 goto build_failed

echo.
echo [2/4] Preparing checklist reorder files...
git add -- TODO_CODEX.md frontend/package.json frontend/src/main.jsx frontend/src/styles.css package-lock.json release-checklist-reorder.bat
if errorlevel 1 goto stage_failed

git diff --cached --quiet
if not errorlevel 1 goto push_release

echo.
echo [3/4] Creating the release commit...
git commit -m "Add drag sorting for checklist items"
if errorlevel 1 goto commit_failed

:push_release
echo.
echo [4/4] Pushing main to origin...
git push origin main
if errorlevel 1 goto push_failed

echo.
echo Checklist reorder release pushed successfully.
pause
exit /b 0

:wrong_branch
echo This release must run from the main branch. Current branch: %CURRENT_BRANCH%
goto failed

:staged_changes
echo Staged changes already exist. Nothing was changed to avoid mixing commits.
goto failed

:build_failed
echo Build failed. Nothing was committed or pushed.
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
