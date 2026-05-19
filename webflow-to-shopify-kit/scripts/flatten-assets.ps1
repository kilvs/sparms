# PowerShell equivalent of flatten-assets.sh — for Windows users.
#
# Usage (from project root):
#   pwsh webflow-to-shopify-kit/scripts/flatten-assets.ps1

param(
    [string]$SourceDir = "webflow-source",
    [string]$AssetsDir = "assets"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $SourceDir -PathType Container)) {
    Write-Error "$SourceDir/ not found."
    exit 1
}

New-Item -ItemType Directory -Path $AssetsDir -Force | Out-Null

# Collision check
$allNames = @()
foreach ($d in @("css", "js", "images", "fonts")) {
    if (Test-Path "$SourceDir/$d") {
        $allNames += (Get-ChildItem "$SourceDir/$d" -File | ForEach-Object { $_.Name })
    }
}
$collisions = $allNames | Group-Object | Where-Object { $_.Count -gt 1 } | ForEach-Object { $_.Name }
if ($collisions) {
    Write-Host "ERROR: filename collisions detected — would overwrite when flattened:" -ForegroundColor Red
    $collisions | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
    Write-Host ""
    Write-Host "Rename one copy of each colliding file in $SourceDir/ before re-running." -ForegroundColor Yellow
    exit 1
}

# Copy
$copied = 0
foreach ($d in @("css", "js", "images", "fonts")) {
    if (Test-Path "$SourceDir/$d") {
        $files = Get-ChildItem "$SourceDir/$d" -File
        $files | Copy-Item -Destination $AssetsDir -Force
        Write-Host "  $d/  ->  $AssetsDir/  ($($files.Count) files)"
        $copied += $files.Count
    }
}

# Rewrite ../fonts/ and ../images/ in CSS
$fixed = 0
foreach ($css in Get-ChildItem "$AssetsDir/*.css" -File) {
    $content = Get-Content $css.FullName -Raw
    if ($content -match '\.\./') {
        $content = $content -replace '\.\./fonts/', '' -replace '\.\./images/', ''
        Set-Content -Path $css.FullName -Value $content -NoNewline
        Write-Host "  rewrote ../fonts/ + ../images/ in $($css.Name)"
        $fixed++
    }
}

# Report
Write-Host ""
Write-Host "✓ $copied files copied into $AssetsDir/" -ForegroundColor Green
Write-Host "✓ $fixed CSS file(s) had asset references rewritten" -ForegroundColor Green

# Final dedupe check
$dupes = Get-ChildItem $AssetsDir -File | Group-Object Name | Where-Object { $_.Count -gt 1 }
if ($dupes) {
    Write-Host "⚠ Duplicate filenames in $AssetsDir/:" -ForegroundColor Yellow
    $dupes | ForEach-Object { Write-Host "  $($_.Name)" }
    exit 1
}
