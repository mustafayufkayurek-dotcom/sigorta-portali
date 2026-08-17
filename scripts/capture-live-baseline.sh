#!/usr/bin/env bash
# Canlı baseline anlık görüntüsü — deploy/regresyon karşılaştırma referansı
# Sunucuda: bash scripts/capture-live-baseline.sh [etiket]
set -euo pipefail

LABEL="${1:-baseline}"
APP_DIR="${APP_DIR:-/opt/app}"
OUT_DIR="$APP_DIR/backups/baselines/${LABEL}_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$OUT_DIR"

cd "$APP_DIR"

{
  echo "label=$LABEL"
  echo "captured_at=$(date -Is)"
  docker inspect sigorta-web --format 'web_image={{.Config.Image}}' 2>/dev/null || true
  docker inspect sigorta-backend --format 'backend_image={{.Config.Image}}' 2>/dev/null || true
  df -h / | tail -1
} > "$OUT_DIR/meta.txt"

cp docker-compose.override.yml "$OUT_DIR/docker-compose.override.yml"

docker ps --format '{{.Names}} | {{.Status}} | {{.Image}}' > "$OUT_DIR/containers.txt"

# Kritik kaynak dosyalarının hash'i
MANIFEST="$APP_DIR/deploy/manifests/CRITICAL_PATHS.txt"
if [ -f "$MANIFEST" ]; then
  while IFS= read -r rel || [ -n "$rel" ]; do
    [[ -z "$rel" || "$rel" =~ ^# ]] && continue
    f="$APP_DIR/$rel"
    if [ -f "$f" ]; then
      shasum -a 256 "$f" >> "$OUT_DIR/critical_hashes.txt"
    else
      echo "MISSING $rel" >> "$OUT_DIR/critical_hashes.txt"
    fi
  done < "$MANIFEST"
fi

echo "Baseline kaydedildi: $OUT_DIR"
cat "$OUT_DIR/meta.txt"
