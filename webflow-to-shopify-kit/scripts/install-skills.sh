#!/usr/bin/env bash
# Installs Shopify's official AI-assistant skills into the current project.
# Skills land in .agents/skills/ and are picked up by Claude Code, GitHub
# Copilot, Cursor, Cline, Amp, Codex, and other AI tooling.
#
# Run from your theme's project root:
#   bash webflow-to-shopify-kit/scripts/install-skills.sh
#
# Requires Node.js (any version with npx/pnpm dlx).

set -e

REPO="https://github.com/shopify/shopify-ai-toolkit"
SKILLS=(
  "shopify-dev"
  "shopify-liquid"
)

# Prefer pnpm dlx if available, fall back to npx
if command -v pnpm >/dev/null 2>&1; then
  RUNNER="pnpm dlx"
elif command -v npx >/dev/null 2>&1; then
  RUNNER="npx --yes"
else
  echo "Need either pnpm or npx installed. Install Node.js first." >&2
  exit 1
fi

for skill in "${SKILLS[@]}"; do
  echo ""
  echo "▶ Installing skill: $skill"
  $RUNNER skills add "$REPO" --skill "$skill"
done

echo ""
echo "✓ Done. Skills installed at .agents/skills/"
echo "  Commit .agents/ so collaborators pick them up:"
echo "  git add .agents && git commit -m \"chore: add shopify-dev + shopify-liquid skills\""
