#!/usr/bin/env bash
# Flattens webflow-source/{css,js,images,fonts}/ into assets/, then rewrites
# Webflow CSS so ../fonts/ and ../images/ references resolve at the new flat
# path. Reports any filename collisions before exiting.
#
# Usage (from project root):
#   bash webflow-to-shopify-kit/scripts/flatten-assets.sh

set -e

SOURCE_DIR="${1:-webflow-source}"
ASSETS_DIR="${2:-assets}"

if [ ! -d "$SOURCE_DIR" ]; then
  echo "ERROR: $SOURCE_DIR/ not found." >&2
  exit 1
fi

mkdir -p "$ASSETS_DIR"

# Collision check (before copying, so we don't accidentally clobber)
collisions=$(
  for d in css js images fonts; do
    [ -d "$SOURCE_DIR/$d" ] && ls -1 "$SOURCE_DIR/$d"
  done | sort | uniq -d
)
if [ -n "$collisions" ]; then
  echo "ERROR: filename collisions detected — would overwrite when flattened:" >&2
  echo "$collisions" >&2
  echo "" >&2
  echo "Rename one copy of each colliding file in $SOURCE_DIR/ before re-running." >&2
  exit 1
fi

# Copy
copied=0
for d in css js images fonts; do
  if [ -d "$SOURCE_DIR/$d" ]; then
    n=$(ls -1 "$SOURCE_DIR/$d" | wc -l)
    cp "$SOURCE_DIR/$d"/* "$ASSETS_DIR/" 2>/dev/null
    echo "  $d/  →  $ASSETS_DIR/  ($n files)"
    copied=$((copied + n))
  fi
done

# Rewrite ../fonts/ and ../images/ in CSS so flat paths resolve
fixed=0
for css in "$ASSETS_DIR"/*.css; do
  if [ -f "$css" ] && grep -q "\.\./" "$css"; then
    sed -i "s|\.\./fonts/||g; s|\.\./images/||g" "$css"
    echo "  rewrote ../fonts/ + ../images/ in $(basename "$css")"
    fixed=$((fixed + 1))
  fi
done

# Final report
echo ""
echo "✓ $copied files copied into $ASSETS_DIR/"
echo "✓ $fixed CSS file(s) had asset references rewritten"
remaining=$(ls -1 "$ASSETS_DIR" | sort | uniq -d | wc -l)
if [ "$remaining" -ne 0 ]; then
  echo "⚠ $remaining duplicate filename(s) ended up in $ASSETS_DIR/ — investigate:" >&2
  ls -1 "$ASSETS_DIR" | sort | uniq -d >&2
  exit 1
fi
