#!/bin/bash
set -euo pipefail

: "${PREVIEW_URL:?Defina PREVIEW_URL (ex.: https://client-kanban-system-<id>.vercel.app)}"

curl -sf "${PREVIEW_URL}/api/kanban" | jq '.[0].title' >/dev/null
curl -sf "${PREVIEW_URL}/kanban" >/dev/null
curl -sf "${PREVIEW_URL}/api/clientes" >/dev/null

echo "Smoke OK"
