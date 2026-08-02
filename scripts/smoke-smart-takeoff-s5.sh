#!/usr/bin/env bash
# Smart Quantity Takeoff — S5 local smoke (no deploy)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/apps/backend"

echo "== Smart Takeoff S5 smoke =="
pnpm exec jest modules/smart-takeoff --no-cache --passWithNoTests

echo "== PASS =="
