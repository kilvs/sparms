#!/usr/bin/env bash
# Pre-push verifier — confirms Shopify's required theme files exist.
#
# Run from your theme root:
#   bash webflow-to-shopify-kit/scripts/check-required-files.sh
#
# Outputs MISSING: <path> for each absent file. Empty output = all present.
# Exits with code 1 if anything is missing, 0 otherwise.

set -e
missing=0
REQUIRED=(
  layout/theme.liquid
  layout/password.liquid
  templates/index.json
  templates/product.json
  templates/collection.json
  templates/list-collections.json
  templates/page.json
  templates/blog.json
  templates/article.json
  templates/search.json
  templates/cart.json
  templates/404.json
  templates/password.json
  templates/gift_card.liquid
  templates/customers/account.liquid
  templates/customers/activate_account.liquid
  templates/customers/addresses.liquid
  templates/customers/login.liquid
  templates/customers/order.liquid
  templates/customers/register.liquid
  templates/customers/reset_password.liquid
  config/settings_schema.json
  config/settings_data.json
  locales/en.default.json
)

for f in "${REQUIRED[@]}"; do
  if [ ! -e "$f" ]; then
    echo "MISSING: $f"
    missing=$((missing + 1))
  fi
done

if [ $missing -eq 0 ]; then
  echo "All required files present."
  exit 0
else
  echo ""
  echo "$missing required file(s) missing. Theme will not pass publish-time validation."
  exit 1
fi
