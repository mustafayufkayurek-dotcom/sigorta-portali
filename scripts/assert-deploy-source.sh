#!/usr/bin/env bash
# Laptop / git kaynağı: canlıya çıkmadan önce. Production /opt/app git deposu değildir — orada çalıştırma.
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [ -z "$ROOT" ]; then
  echo "HATA: git deposu yok. Bu kapı yalnız geliştirme kopyasında."
  exit 1
fi
cd "$ROOT"
BRANCH="$(git branch --show-current || true)"
case "$BRANCH" in
  archive/*|fix/v483-guven-paketi)
    echo "HATA: Bu dal tezgâh/arşiv. Canlı kaynak değil: $BRANCH"
    exit 1
    ;;
esac
if [ -n "$(git status --porcelain)" ]; then
  echo "HATA: Çalışma ağacı kirli. Önce arşiv veya commit — yarım dosya canlıya gitmez."
  git status -sb | head
  exit 1
fi
echo "PASS kaynak: $BRANCH $(git rev-parse --short HEAD)"
