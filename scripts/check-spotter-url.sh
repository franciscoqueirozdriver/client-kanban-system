set -e
rg --glob '!README.md' --glob '!scripts/check-spotter-url.sh' -n -P "apiv3\\.exactspotter|:81|http://api\\.exactspotter|/api/v3(?![a-zA-Z])" || true
if rg --glob '!README.md' --glob '!scripts/check-spotter-url.sh' -n -P "apiv3\\.exactspotter|:81|/api/v3(?![a-zA-Z])" ; then
  echo "❌ Padrões proibidos encontrados. Corrija antes do deploy."
  exit 1
fi
echo "✅ Sem padrões proibidos."
