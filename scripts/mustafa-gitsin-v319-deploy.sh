#!/usr/bin/env bash
# Tek Allow ile: push + full deploy v319 + smoke
# bash scripts/mustafa-gitsin-v319-deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."

echo "=== Git push ==="
git push -u origin safety/pre-v318-kilit-20260712

echo "=== Full deploy web v319 + backend v319 (migration varsa uygulanır) ==="
bash scripts/deploy-full-production.sh v319-pazartesi-operasyon

echo "=== Smoke ==="
bash scripts/post-deploy-smoke.sh

echo "OK — footer v319. Rollback: web v318 / backend v303"
