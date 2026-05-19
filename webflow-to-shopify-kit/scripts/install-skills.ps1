# PowerShell equivalent of install-skills.sh — for Windows users.
#
# Installs Shopify's official AI-assistant skills into the current project.
# Skills land in .agents/skills/ and are picked up by Claude Code, GitHub
# Copilot, Cursor, Cline, Amp, Codex, and other AI tooling.
#
# Run from your theme's project root:
#   pwsh webflow-to-shopify-kit/scripts/install-skills.ps1
#
# Requires Node.js (any version with npx or pnpm).

$ErrorActionPreference = "Stop"
$repo = "https://github.com/shopify/shopify-ai-toolkit"
$skills = @("shopify-dev", "shopify-liquid")

# Prefer pnpm dlx if available, fall back to npx
if (Get-Command pnpm -ErrorAction SilentlyContinue) {
    $runner = "pnpm"
    $runnerArgs = @("dlx")
} elseif (Get-Command npx -ErrorAction SilentlyContinue) {
    $runner = "npx"
    $runnerArgs = @("--yes")
} else {
    Write-Error "Need either pnpm or npx installed. Install Node.js first."
    exit 1
}

foreach ($skill in $skills) {
    Write-Host ""
    Write-Host "▶ Installing skill: $skill"
    & $runner @runnerArgs skills add $repo --skill $skill
}

Write-Host ""
Write-Host "✓ Done. Skills installed at .agents/skills/"
Write-Host "  Commit .agents/ so collaborators pick them up:"
Write-Host '  git add .agents && git commit -m "chore: add shopify-dev + shopify-liquid skills"'
