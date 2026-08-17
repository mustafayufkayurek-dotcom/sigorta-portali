#!/usr/bin/env bash
# =============================================================================
#  Offsite / ikinci konum yedek — DB sql.gz + uploads tar.gz
# =============================================================================
# SUCCESS yalnız: yerel dosya sağlıklı + rclone upload + B2 API verify + checksum.
# f005 HEAD kullanılmaz (bu VPS'ten timeout).
# Cron: 30 2 * * * /opt/app/scripts/offsite-backup.sh >> /opt/app/logs/offsite-backup.log 2>&1
# =============================================================================
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/app}"
LOG_FILE="${OFFSITE_LOG:-$APP_DIR/logs/offsite-backup.log}"
NOTIFY="${NOTIFY_SCRIPT:-$APP_DIR/scripts/monitoring/telegram-notify.sh}"
MIN_DB="${MIN_BACKUP_SIZE_BYTES:-10240}"
MIN_UP="${MIN_UPLOADS_BACKUP_BYTES:-100}"
mkdir -p "$(dirname "$LOG_FILE")"
START_TS="$(date +%s)"
TIMESTAMP="$(date '+%Y-%m-%d %H:%M:%S')"
log() { echo "$TIMESTAMP $*" | tee -a "$LOG_FILE"; }

if [ -f "$APP_DIR/.env.production" ]; then
  set -a; source "$APP_DIR/.env.production" 2>/dev/null || true; set +a
fi

OFFSITE_DIR="${OFFSITE_BACKUP_DIR:-}"
RCLONE_REMOTE="${RCLONE_REMOTE:-}"

pick_latest_ok() {
  local min="$1"; shift
  local f size
  for f in $(ls -t "$@" 2>/dev/null); do
    [ -f "$f" ] || continue
    size=$(wc -c < "$f" | tr -d ' ')
    if [ "$size" -ge "$min" ] && gzip -t "$f" 2>/dev/null; then
      echo "$f"
      return 0
    fi
  done
  return 1
}

LATEST_DB="$(pick_latest_ok "$MIN_DB" \
  "$APP_DIR/backups"/backup_*.sql.gz \
  /var/backups/meridyen/backup_*.sql.gz \
  "$APP_DIR/backups"/pre_*.sql.gz \
  /var/backups/meridyen/pre_*.sql.gz || true)"
LATEST_UP="$(pick_latest_ok "$MIN_UP" \
  "$APP_DIR/backups/uploads"/uploads_*.tar.gz \
  /var/backups/meridyen/uploads/uploads_*.tar.gz || true)"

fail_health() {
  local err="$1"
  local db_json="$2"
  local up_json="$3"
  local dur=$(( $(date +%s) - START_TS ))
  python3 "$APP_DIR/scripts/backup-health-record.py" \
    --duration-seconds "$dur" \
    --error "$err" \
    --db-json "$db_json" \
    --uploads-json "$up_json" \
    --scheduler-json "$(python3 "$APP_DIR/scripts/backup-scheduler-status.py" 2>/dev/null || echo '{}')" \
    || true
  python3 "$APP_DIR/scripts/backup-notify.py" || true
  log "HATA: $err"
  exit 1
}

empty_art() {
  python3 -c 'import json,sys; print(json.dumps({"localOk":False,"uploadOk":False,"remoteVerifyOk":False,"checksumOk":False,"fileName":"","bytes":0,"encrypted":"none","error":sys.argv[1]}))' "$1"
}

if [ -z "$LATEST_DB" ] || [ -z "$LATEST_UP" ]; then
  fail_health "Yerel DB veya uploads yedeği eksik/çok küçük" \
    "$(empty_art "db missing")" \
    "$(empty_art "uploads missing")"
fi

DB_BYTES=$(wc -c < "$LATEST_DB" | tr -d ' ')
UP_BYTES=$(wc -c < "$LATEST_UP" | tr -d ' ')
log "Kaynak DB=$(basename "$LATEST_DB") (${DB_BYTES} byte) uploads=$(basename "$LATEST_UP") (${UP_BYTES} byte)"

if [ -n "$OFFSITE_DIR" ]; then
  mkdir -p "$OFFSITE_DIR/db" "$OFFSITE_DIR/uploads"
  cp -f "$LATEST_DB" "$OFFSITE_DIR/db/"
  cp -f "$LATEST_UP" "$OFFSITE_DIR/uploads/"
  log "PASS: ikinci dizin → $OFFSITE_DIR"
fi

if [ -z "$RCLONE_REMOTE" ] || ! command -v rclone >/dev/null 2>&1; then
  fail_health "RCLONE_REMOTE yok veya rclone yok" \
    "$(python3 -c 'import json,sys; print(json.dumps({"localOk":True,"uploadOk":False,"remoteVerifyOk":False,"checksumOk":False,"fileName":sys.argv[1],"bytes":int(sys.argv[2]),"encrypted":"none"}))' "$(basename "$LATEST_DB")" "$DB_BYTES")" \
    "$(python3 -c 'import json,sys; print(json.dumps({"localOk":True,"uploadOk":False,"remoteVerifyOk":False,"checksumOk":False,"fileName":sys.argv[1],"bytes":int(sys.argv[2]),"encrypted":"none"}))' "$(basename "$LATEST_UP")" "$UP_BYTES")"
fi

rclone_copy() {
  rclone copy "$1" "$2" \
    --no-check-dest \
    --ignore-checksum \
    --retries 3 \
    --low-level-retries 5 \
    --timeout 2m \
    --contimeout 30s
}

if ! rclone_copy "$LATEST_DB" "$RCLONE_REMOTE/db/"; then
  fail_health "B2 DB upload başarısız" \
    "$(python3 -c 'import json,sys; print(json.dumps({"localOk":True,"uploadOk":False,"remoteVerifyOk":False,"checksumOk":False,"fileName":sys.argv[1],"bytes":int(sys.argv[2]),"encrypted":"none"}))' "$(basename "$LATEST_DB")" "$DB_BYTES")" \
    "$(python3 -c 'import json,sys; print(json.dumps({"localOk":True,"uploadOk":False,"remoteVerifyOk":False,"checksumOk":False,"fileName":sys.argv[1],"bytes":int(sys.argv[2]),"encrypted":"none"}))' "$(basename "$LATEST_UP")" "$UP_BYTES")"
fi
if ! rclone_copy "$LATEST_UP" "$RCLONE_REMOTE/uploads/"; then
  fail_health "B2 uploads upload başarısız" \
    "$(python3 -c 'import json,sys; print(json.dumps({"localOk":True,"uploadOk":True,"remoteVerifyOk":False,"checksumOk":False,"fileName":sys.argv[1],"bytes":int(sys.argv[2]),"encrypted":"none"}))' "$(basename "$LATEST_DB")" "$DB_BYTES")" \
    "$(python3 -c 'import json,sys; print(json.dumps({"localOk":True,"uploadOk":False,"remoteVerifyOk":False,"checksumOk":False,"fileName":sys.argv[1],"bytes":int(sys.argv[2]),"encrypted":"none"}))' "$(basename "$LATEST_UP")" "$UP_BYTES")"
fi

VERIFY_DB="$(python3 "$APP_DIR/scripts/backup-b2-verify.py" --prefix db --local "$LATEST_DB" || true)"
VERIFY_UP="$(python3 "$APP_DIR/scripts/backup-b2-verify.py" --prefix uploads --local "$LATEST_UP" || true)"

parse_ok() {
  python3 -c 'import json,sys; d=json.loads(sys.argv[1] or "{}"); print("1" if d.get("ok") else "0")' "$1"
}

DB_V_OK="$(parse_ok "$VERIFY_DB")"
UP_V_OK="$(parse_ok "$VERIFY_UP")"

db_art() {
  python3 -c 'import json,sys
v=json.loads(sys.argv[1] or "{}")
print(json.dumps({
  "localOk": True,
  "uploadOk": True,
  "remoteVerifyOk": bool(v.get("ok")),
  "checksumOk": bool(v.get("sha1Match") and v.get("sizeMatch")),
  "fileName": sys.argv[2],
  "bytes": int(sys.argv[3]),
  "encrypted": "none",
  "b2Key": v.get("fileName"),
  "remoteBytes": v.get("remoteBytes"),
  "sha1Match": v.get("sha1Match"),
  "md5Match": v.get("md5Match"),
}))' "$1" "$2" "$3"
}

DB_JSON="$(db_art "$VERIFY_DB" "$(basename "$LATEST_DB")" "$DB_BYTES")"
UP_JSON="$(db_art "$VERIFY_UP" "$(basename "$LATEST_UP")" "$UP_BYTES")"

if [ "$DB_V_OK" != "1" ] || [ "$UP_V_OK" != "1" ]; then
  fail_health "B2 remote verification veya checksum başarısız" "$DB_JSON" "$UP_JSON"
fi

# Aylık kopya (1. gün veya monthly yoksa)
DAY="$(date +%d)"
if [ "$DAY" = "01" ] || [ "$DAY" = "1" ]; then
  rclone_copy "$LATEST_DB" "$RCLONE_REMOTE/monthly/" || log "UYARI: monthly DB kopyası atlandı"
  rclone_copy "$LATEST_UP" "$RCLONE_REMOTE/monthly/" || log "UYARI: monthly uploads kopyası atlandı"
fi

DUR=$(( $(date +%s) - START_TS ))
python3 "$APP_DIR/scripts/backup-health-record.py" \
  --duration-seconds "$DUR" \
  --db-json "$DB_JSON" \
  --uploads-json "$UP_JSON" \
  --scheduler-json "$(python3 "$APP_DIR/scripts/backup-scheduler-status.py" 2>/dev/null || echo '{}')" \
  --encryption none
python3 "$APP_DIR/scripts/backup-notify.py" || true
python3 "$APP_DIR/scripts/backup-b2-retention.py" >> "$LOG_FILE" 2>&1 || log "UYARI: retention atlandı"

log "PASS: rclone + B2 API verify db=$(basename "$LATEST_DB") uploads=$(basename "$LATEST_UP")"
exit 0
