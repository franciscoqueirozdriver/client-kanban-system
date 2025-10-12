#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT_DIR="$SCRIPT_DIR/out"
mkdir -p "$OUT_DIR"

RANGE="0230841..9bb17f5"
SINCE=""
UNTIL=""

for arg in "$@"; do
  case $arg in
    --range=*)
      RANGE="${arg#*=}"
      shift
      ;;
    --since=*)
      SINCE="${arg#*=}"
      shift
      ;;
    --until=*)
      UNTIL="${arg#*=}"
      shift
      ;;
    *)
      echo "Uso: $0 [--range=HASH1..HASH2] [--since=DATA] [--until=DATA]" >&2
      exit 1
      ;;
  esac
done

GIT_LOG_ARGS=("log" "$RANGE" "--find-renames" "--summary" "--date=iso" "--pretty=format:%H|%ad|%an|%ae|%s" "--numstat")
FULL_LOG_ARGS=("log" "$RANGE" "--date=iso" "--pretty=format:%H%n%ad%n%an%n%ae%n%B%n---")

if [[ -n "$SINCE" ]]; then
  GIT_LOG_ARGS=("log" "$RANGE" "--find-renames" "--summary" "--date=iso" "--pretty=format:%H|%ad|%an|%ae|%s" "--numstat" "--since=$SINCE")
  FULL_LOG_ARGS=("log" "$RANGE" "--date=iso" "--pretty=format:%H%n%ad%n%an%n%ae%n%B%n---" "--since=$SINCE")
fi

if [[ -n "$UNTIL" ]]; then
  GIT_LOG_ARGS+=("--until=$UNTIL")
  FULL_LOG_ARGS+=("--until=$UNTIL")
fi

GIT_LOG_PATH="$OUT_DIR/gitlog.txt"
FULL_LOG_PATH="$OUT_DIR/commits_full.txt"

git "${GIT_LOG_ARGS[@]}" > "$GIT_LOG_PATH"
git "${FULL_LOG_ARGS[@]}" > "$FULL_LOG_PATH"

node "$SCRIPT_DIR/parse-log.js"
node "$SCRIPT_DIR/gerar-heatmap.js" --range="$RANGE" ${SINCE:+--since="$SINCE"} ${UNTIL:+--until="$UNTIL"}

echo "Relatórios gerados:"
echo "  $OUT_DIR/commits.csv"
echo "  $OUT_DIR/commits.json"
echo "  $OUT_DIR/files.csv"
echo "  $OUT_DIR/heatmap_pastas.csv"
echo "  $SCRIPT_DIR/AUDITORIA.md"
