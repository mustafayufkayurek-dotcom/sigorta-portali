#!/usr/bin/env bash
# Canlıda bitmiş iş — her alımda, --skip-rsync olsa da.
# v583 alımında skip-rsync bu kilitleri atladı; boş import Kullanıcılar derlemesini kesti.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

echo "=== Canlı bitmiş iş kilitleri ==="

node --experimental-strip-types --test "$SCRIPT_DIR/canli-bitmis-is-deploy.lock.spec.ts"

FULL="$REPO_ROOT/scripts/deploy-full-production.sh"
WEB="$REPO_ROOT/scripts/deploy-web-production.sh"
if ! grep -q 'smoke-canli-bitmis-is.sh' "$FULL" || ! grep -q 'smoke-canli-bitmis-is.sh' "$WEB"; then
  echo "HATA: deploy scripti bu kilit listesini çağırmaz."
  exit 1
fi
if awk '
  /smoke-canli-bitmis-is\.sh/ { found=1 }
  /rsync -avz/ && found { ok=1 }
  END { exit(ok ? 0 : 1) }
' "$FULL"; then
  :
else
  echo "HATA: bitmiş iş kilitleri rsync’ten sonra veya yok — skip-rsync yine atlar."
  exit 1
fi

bash "$SCRIPT_DIR/smoke-acil-netlesen.sh"
bash "$SCRIPT_DIR/smoke-acil-file-owner.sh"
bash "$SCRIPT_DIR/smoke-hasar-rapor-revizyon.sh"
bash "$SCRIPT_DIR/smoke-hasar-dijital-onay.sh"
bash "$SCRIPT_DIR/smoke-v541-ek.sh"
bash "$SCRIPT_DIR/smoke-outbound-mail.sh"
bash "$SCRIPT_DIR/smoke-resim-akis.sh"
bash "$SCRIPT_DIR/smoke-evrak-v544.sh"
bash "$SCRIPT_DIR/smoke-sigorta-evrak.sh"
bash "$SCRIPT_DIR/smoke-hasar-hakedis.sh"
bash "$SCRIPT_DIR/smoke-hasar-tahsilat-gelir.sh"
bash "$SCRIPT_DIR/smoke-acil-supplier-assignment.sh"
bash "$SCRIPT_DIR/smoke-liste-gorunum.sh"
bash "$SCRIPT_DIR/smoke-panel-auth-gate.sh"
bash "$SCRIPT_DIR/smoke-baslik-hint.sh"
bash "$SCRIPT_DIR/smoke-finans-kart.sh"

echo "=== Canlı bitmiş iş kilitleri: PASS ==="
