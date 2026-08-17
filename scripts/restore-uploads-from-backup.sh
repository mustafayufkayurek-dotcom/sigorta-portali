#!/usr/bin/env bash
# Uploads arşivinden geri yükleme (dikkat: mevcut dosyaların üzerine yazabilir)
# Kullanım:
#   bash scripts/restore-uploads-from-backup.sh /opt/app/backups/uploads/uploads_YYYYMMDD_HHMMSS.tar.gz
set -euo pipefail

ARCHIVE="${1:?Kullanım: restore-uploads-from-backup.sh uploads_....tar.gz}"
APP_DIR="${APP_DIR:-/opt/app}"
TARGET_PARENT="${UPLOADS_PARENT:-$APP_DIR/apps/backend}"

if [ ! -f "$ARCHIVE" ]; then
  echo "HATA: Arşiv yok: $ARCHIVE"
  exit 1
fi

echo "Geri yüklenecek: $ARCHIVE → $TARGET_PARENT/uploads"
echo "Devam için 5 sn... (Ctrl+C ile iptal)"
sleep 5

mkdir -p "$TARGET_PARENT"
tar -xzf "$ARCHIVE" -C "$TARGET_PARENT"
echo "TAMAM. Bütünlük: bash scripts/verify-upload-integrity.sh"
