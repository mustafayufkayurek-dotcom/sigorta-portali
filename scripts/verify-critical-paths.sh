#!/usr/bin/env bash
# Yerel ↔ sunucu kritik dosya hash karşılaştırması
# Kullanım:
#   bash scripts/verify-critical-paths.sh              # yerel hash listesi üret
#   bash scripts/verify-critical-paths.sh --remote     # sunucu ile karşılaştır
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
MANIFEST="$PROJECT_DIR/deploy/manifests/CRITICAL_PATHS.txt"
REMOTE_HOST="${REMOTE_HOST:-root@94.138.216.18}"
REMOTE_APP="${REMOTE_APP:-/opt/app}"

hash_file() {
  local f="$1"
  if [ -f "$f" ]; then
    shasum -a 256 "$f" | awk '{print $1}'
  else
    echo "MISSING"
  fi
}

if [ ! -f "$MANIFEST" ]; then
  echo "HATA: $MANIFEST bulunamadı"
  exit 1
fi

FAIL=0
while IFS= read -r rel || [ -n "$rel" ]; do
  [[ -z "$rel" || "$rel" =~ ^# ]] && continue
  local_path="$PROJECT_DIR/$rel"
  local_hash="$(hash_file "$local_path")"

  if [ "${1:-}" != "--remote" ]; then
    printf '%s  %s\n' "$local_hash" "$rel"
    continue
  fi

  remote_path="$REMOTE_APP/$rel"
  remote_hash="$(ssh -n -o BatchMode=yes "$REMOTE_HOST" "if [ -f '$remote_path' ]; then shasum -a 256 '$remote_path' | awk '{print \$1}'; else echo MISSING; fi" 2>/dev/null || echo SSH_FAIL)"

  if [ "$local_hash" = "$remote_hash" ] && [ "$local_hash" != "MISSING" ]; then
    printf 'OK   %s\n' "$rel"
  else
    printf 'FARK %s  yerel=%s  sunucu=%s\n' "$rel" "$local_hash" "$remote_hash"
    FAIL=$((FAIL + 1)) || true
  fi
done < "$MANIFEST"

if [ "${1:-}" = "--remote" ]; then
  if [ "$FAIL" -gt 0 ]; then
    echo ""
    echo "HATA: $FAIL kritik dosyada fark var. Deploy durdurulmalı."
    exit 1
  fi
  echo ""
  echo "Tüm kritik dosyalar uyumlu."
fi
