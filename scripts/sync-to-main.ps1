param(
  [string]$SourceRoot = "C:\Users\longhuynh\Documents\Codex\2026-06-24\m-nh",
  [string]$DestinationRoot = "D:\Codex_Project"
)

$ErrorActionPreference = "Stop"

$files = @(
  "frontend\src\api.js",
  "frontend\src\main.jsx",
  "frontend\src\styles.css",
  "frontend\src\assets\login-background.jpg",
  "backend\src\server.js",
  "backend\src\reminders.js",
  "supabase\schema.sql",
  "supabase\run_this_fix_tasklist_encoding.sql",
  "supabase\run_this_update_recurring_monthly.sql",
  "supabase\run_this_update_project_avatar_inactive_review_cleanup.sql",
  "render.yaml",
  ".github\workflows\deploy-frontend.yml",
  "docs\render-github-pages-deploy.md",
  "work\qa-smoke.mjs",
  "TODO_CODEX.md"
)

$deleteFiles = @(
  "frontend\vite.config.js"
)

if (-not (Test-Path -LiteralPath $SourceRoot)) {
  throw "Source root not found: $SourceRoot"
}

if (-not (Test-Path -LiteralPath $DestinationRoot)) {
  New-Item -ItemType Directory -Path $DestinationRoot -Force | Out-Null
}

foreach ($file in $files) {
  $source = Join-Path $SourceRoot $file
  $destination = Join-Path $DestinationRoot $file

  if (-not (Test-Path -LiteralPath $source)) {
    throw "Missing source file: $source"
  }

  $destinationDirectory = Split-Path $destination -Parent
  if (-not (Test-Path -LiteralPath $destinationDirectory)) {
    New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
  }

  Copy-Item -LiteralPath $source -Destination $destination -Force

  $sourceHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $source).Hash
  $destinationHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $destination).Hash
  if ($sourceHash -ne $destinationHash) {
    throw "Hash mismatch after copy: $file"
  }

  Write-Host "OK $file"
}

foreach ($file in $deleteFiles) {
  $destination = Join-Path $DestinationRoot $file
  if (Test-Path -LiteralPath $destination) {
    Remove-Item -LiteralPath $destination -Force
    Write-Host "REMOVED $file"
  }
}

Write-Host ""
Write-Host "Synced updated files to $DestinationRoot"
Write-Host "Next:"
Write-Host "  cd /d D:\Codex_Project"
Write-Host "  npm.cmd run lint"
Write-Host "  node --check backend\src\server.js; node --check backend\src\reminders.js"
Write-Host "  npm.cmd run build"
