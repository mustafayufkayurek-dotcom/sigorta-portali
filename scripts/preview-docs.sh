#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
PORT="${PORT:-8765}"
if lsof -ti:"$PORT" >/dev/null 2>&1; then
  echo "Port ${PORT} kullanımda — önizleme sunucusu yeniden başlatılıyor..."
  lsof -ti:"$PORT" | xargs kill 2>/dev/null || true
  sleep 0.3
fi
exec node scripts/serve-preview.js
