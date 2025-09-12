#!/bin/sh
set -e

# This script checks for forbidden URL patterns related to the Spotter API.
# It uses ripgrep (rg) for searching. The `|| true` prevents the script from exiting
# if rg finds no matches (which is the success case).
# The second rg command runs without `|| true`. If it finds a match, it prints it,
# and the script proceeds to the `if` block, which then exits with an error.

if rg -q "apiv3\\.exactspotter|:81|http://api\\.exactspotter|/api/v3(?![a-zA-Z])" -- ".(js|jsx|ts|tsx)" ':!scripts/check-spotter-url.sh'; then
  echo "❌ Forbidden Spotter URL patterns found in the codebase."
  echo "Please use the centralized SPOTTER_BASE_URL from lib/exactSpotter.js and the joinUrl helper."
  exit 1
else
  echo "✅ No forbidden Spotter URL patterns found."
fi
