#!/usr/bin/env bash
# Runs every fully-automatable step of the Webflow → Shopify conversion in
# order. Stops on the first error. Assumes:
#   - webflow-source/ exists (contains the unzipped Webflow export)
#   - this kit lives at webflow-to-shopify-kit/
#
# Usage (from project root):
#   bash webflow-to-shopify-kit/scripts/convert-all.sh
#
# After this runs cleanly, only the judgement-call steps remain:
# - fill placeholders in layout/theme.liquid (using AUDIT.md)
# - build sections/header.liquid + sections/footer.liquid by hand
# - wire commerce sections (product/collection/blog) to {{ product.* }} etc.
# - run check-required-files.sh
#
# An AI assistant with the CONVERT_PROMPT.md context can finish those for you.

set -euo pipefail
KIT="webflow-to-shopify-kit"

if [ ! -d "webflow-source" ]; then
  echo "ERROR: webflow-source/ not found. Unzip your Webflow export there first." >&2
  exit 1
fi
if [ ! -d "$KIT" ]; then
  echo "ERROR: $KIT/ not found. Copy the kit folder into the project root first." >&2
  exit 1
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Webflow → Shopify automated conversion"
echo "═══════════════════════════════════════════════════════════════"

echo ""
echo "▶ Step 0: install Shopify AI skills (skipped if already installed)"
echo "──────────────────────────────────────────────"
if [ ! -d ".agents/skills/shopify-dev" ] || [ ! -d ".agents/skills/shopify-liquid" ]; then
  bash "$KIT/scripts/install-skills.sh"
else
  echo "  ✓ skills already at .agents/skills/ — skipping"
fi

echo ""
echo "▶ Step 2: audit the Webflow source → AUDIT.md"
echo "──────────────────────────────────────────────"
bash "$KIT/scripts/audit-source.sh"

echo ""
echo "▶ Step 3: flatten + rewrite assets"
echo "──────────────────────────────────────────────"
bash "$KIT/scripts/flatten-assets.sh"

echo ""
echo "▶ Step 4: bootstrap starter theme"
echo "──────────────────────────────────────────────"
cp -r "$KIT/starter-theme/." .
echo "  ✓ copied starter-theme/ into project root"
echo "  ✓ includes CLAUDE.md, theme.liquid (with placeholders), customer templates, AJAX cart, …"

echo ""
echo "▶ Step 6: extract page content (HTML → sections + templates)"
echo "──────────────────────────────────────────────"
node "$KIT/scripts/convert.cjs"

echo ""
echo "▶ Step 7: convert Webflow newsletter forms"
echo "──────────────────────────────────────────────"
if grep -q "wf-form-Newsletter-Form" sections/*.liquid 2>/dev/null; then
  node "$KIT/scripts/convert-forms.cjs"
else
  echo "  (no newsletter forms found in sections/ — skipping)"
fi

echo ""
echo "▶ Step 10: verify Shopify-required files"
echo "──────────────────────────────────────────────"
bash "$KIT/scripts/check-required-files.sh" || true

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Automated steps complete."
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "  Still TODO (need judgement — hand to an AI assistant with"
echo "  webflow-to-shopify-kit/CONVERT_PROMPT.md as the brief):"
echo ""
echo "  • Step 5  Fill placeholders in layout/theme.liquid"
echo "            (paste values from AUDIT.md)"
echo "  • Step 8  Build sections/header.liquid + sections/footer.liquid"
echo "            (lift from webflow-source/index.html, wrap with schema)"
echo "  • Step 9  (optional) Split homepage into per-block sections"
echo "  • Wire commerce in sections/page-product.liquid + page-collection.liquid"
echo "    (product title, price, variant picker, add-to-cart form, etc.)"
echo ""
echo "  When that's done, you're ready to commit + push + import to Shopify."
