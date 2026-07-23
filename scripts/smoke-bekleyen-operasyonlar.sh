#!/usr/bin/env bash
# Dosya Sorumlusu — Bekleyen Operasyonlar smoke
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASE="${CAPTURE_BASE:-http://localhost:3001}"
API="${CAPTURE_API:-http://127.0.0.1:3000/api/v1}"
EMAIL="${LOGIN_EMAIL:-admin@meridyenassistance.com}"
PASSWORD="${LOGIN_PASSWORD:-admin123}"
OUT="${ROOT}/docs/project-governance/canli-kabul/ekran-goruntuleri/bekleyen-operasyonlar-smoke-$(date +%Y%m%d)"
mkdir -p "$OUT"

echo "== Bekleyen Operasyonlar smoke =="
echo "BASE=$BASE"

if ! rg -q "PendingOperationsPanel" "$ROOT/apps/web/src/app/panel/page.tsx"; then
  echo "FAIL: PendingOperationsPanel panel/page.tsx içinde yok"
  exit 1
fi
if rg -n "PendingOperationsPanel" "$ROOT/apps/web/src/features/dashboard/components/management-dashboard" 2>/dev/null; then
  echo "FAIL: PendingOperationsPanel yönetim dashboard’a sızmış"
  exit 1
fi
if ! rg -q "layout.layoutId === 'management'" "$ROOT/apps/web/src/app/panel/page.tsx"; then
  echo "FAIL: management layout ayrımı yok"
  exit 1
fi
# default layout hâlâ PendingActionsWidget kullanır (Yönetim değil, finans/default)
if ! rg -q "PendingActionsWidget" "$ROOT/apps/web/src/app/panel/page.tsx"; then
  echo "FAIL: default layout PendingActionsWidget kaybolmuş"
  exit 1
fi
echo "PASS: kod izolasyonu"

node "$ROOT/apps/web/scripts/smoke-bekleyen-operasyonlar.mjs" "$BASE" "$API" "$EMAIL" "$PASSWORD" "$OUT"
echo "PASS: browser smoke"
echo "OUT=$OUT"
