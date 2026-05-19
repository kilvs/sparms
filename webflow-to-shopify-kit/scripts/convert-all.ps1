# PowerShell equivalent of convert-all.sh — for Windows users.
#
# Usage (from project root):
#   pwsh webflow-to-shopify-kit/scripts/convert-all.ps1

$ErrorActionPreference = "Stop"
$Kit = "webflow-to-shopify-kit"

if (-not (Test-Path "webflow-source" -PathType Container)) {
    Write-Error "webflow-source/ not found. Unzip your Webflow export there first."
    exit 1
}
if (-not (Test-Path $Kit -PathType Container)) {
    Write-Error "$Kit/ not found. Copy the kit folder into the project root first."
    exit 1
}

function Heading($txt) {
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "  $txt" -ForegroundColor Cyan
    Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
}
function Step($txt) {
    Write-Host ""
    Write-Host "▶ $txt" -ForegroundColor Yellow
    Write-Host "──────────────────────────────────────────────"
}

Heading "Webflow → Shopify automated conversion"

Step "Step 0: install Shopify AI skills (skipped if already installed)"
if ((Test-Path ".agents/skills/shopify-dev") -and (Test-Path ".agents/skills/shopify-liquid")) {
    Write-Host "  ✓ skills already at .agents/skills/ — skipping" -ForegroundColor Green
} else {
    & pwsh "$Kit/scripts/install-skills.ps1"
}

Step "Step 2: audit the Webflow source → AUDIT.md"
& pwsh "$Kit/scripts/audit-source.ps1"

Step "Step 3: flatten + rewrite assets"
& pwsh "$Kit/scripts/flatten-assets.ps1"

Step "Step 4: bootstrap starter theme"
Copy-Item -Recurse -Force "$Kit/starter-theme/*" .
# .shopifyignore is treated as hidden by Copy-Item — copy explicitly
Copy-Item -Force "$Kit/starter-theme/.shopifyignore" .
Write-Host "  ✓ copied starter-theme/ into project root" -ForegroundColor Green
Write-Host "  ✓ includes CLAUDE.md, theme.liquid (with placeholders), customer templates, AJAX cart, …" -ForegroundColor Green

Step "Step 6: extract page content (HTML → sections + templates)"
& node "$Kit/scripts/convert.cjs"

Step "Step 7: convert Webflow newsletter forms"
$hasNewsletter = Get-ChildItem sections/*.liquid -ErrorAction SilentlyContinue | Select-String -Pattern "wf-form-Newsletter-Form" -SimpleMatch -List
if ($hasNewsletter) {
    & node "$Kit/scripts/convert-forms.cjs"
} else {
    Write-Host "  (no newsletter forms found in sections/ — skipping)" -ForegroundColor DarkGray
}

Step "Step 10: verify Shopify-required files"
& bash "$Kit/scripts/check-required-files.sh"

Heading "Automated steps complete."

Write-Host ""
Write-Host "  Still TODO (need judgement — hand to an AI assistant with"
Write-Host "  webflow-to-shopify-kit/CONVERT_PROMPT.md as the brief):"
Write-Host ""
Write-Host "  • Step 5  Fill placeholders in layout/theme.liquid" -ForegroundColor Yellow
Write-Host "            (paste values from AUDIT.md)"
Write-Host "  • Step 8  Build sections/header.liquid + sections/footer.liquid" -ForegroundColor Yellow
Write-Host "            (lift from webflow-source/index.html, wrap with schema)"
Write-Host "  • Step 9  (optional) Split homepage into per-block sections" -ForegroundColor Yellow
Write-Host "  • Wire commerce in sections/page-product.liquid + page-collection.liquid" -ForegroundColor Yellow
Write-Host "    (product title, price, variant picker, add-to-cart form, etc.)"
Write-Host ""
Write-Host "  When that's done, you're ready to commit + push + import to Shopify." -ForegroundColor Green
