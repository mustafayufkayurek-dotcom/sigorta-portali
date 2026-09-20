#!/usr/bin/env bash
# İkinci yer yedek durumu — şifre/kutu/anahtar yazılmaz.
# Sunucuda: APP_DIR=/opt/app bash scripts/offsite-status.sh
set -euo pipefail
APP_DIR="${APP_DIR:-/opt/app}"
HEALTH="${BACKUP_HEALTH_DIR:-$APP_DIR/logs/backup-health}/latest.json"
WARN_H="${BACKUP_WATCHDOG_WARNING_HOURS:-24}"

echo "Yedek ikinci yer"
echo "Dosya ve resim yedeği gece ikinci yere gider. Şifre ve kutu ayarı burada durmaz; felakette elinizdeki kasadadır."

if crontab -l 2>/dev/null | grep -q 'offsite-backup.sh'; then
  echo "Saatli iş: duruyor"
else
  echo "Saatli iş: yok"
fi

if [ ! -f "$HEALTH" ]; then
  echo "Son başarılı ikinci yer: bilinmiyor"
  exit 1
fi

python3 - "$HEALTH" "$WARN_H" <<'PY'
import json, sys
from datetime import datetime
path, warn_h = sys.argv[1], int(sys.argv[2])
data = json.loads(open(path, encoding="utf-8").read())
ts = data.get("lastSuccessAt")
result = data.get("result") or "—"
if not ts:
    print("Son başarılı ikinci yer: bilinmiyor")
    raise SystemExit(1)
dt = datetime.fromisoformat(ts)
now = datetime.now(dt.tzinfo) if dt.tzinfo else datetime.now()
hours = int((now - dt).total_seconds() // 3600)
print(f"Son kayıt: {result}")
print(f"Son başarılı ikinci yer: {hours} saat önce")
if hours >= warn_h:
    raise SystemExit(1)
PY
