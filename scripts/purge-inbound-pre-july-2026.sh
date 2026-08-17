#!/usr/bin/env bash
# Operasyon gelen kutusu — 1 Temmuz 2026 öncesi tam temizlik (Meridyen DB only; Outlook'a dokunmaz)
# Yerel: bash scripts/purge-inbound-pre-july-2026.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/deploy-env.sh"

CUTOFF='2026-06-30T21:00:00.000Z'
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-sigorta-postgres}"

remote_psql() {
  local sql="$1"
  ssh -o BatchMode=yes "$REMOTE_HOST" "cd \"$REMOTE_APP\" && \
    set -a && source .env.production 2>/dev/null && set +a && \
    docker exec -e PGPASSWORD=\${POSTGRES_PASSWORD} $POSTGRES_CONTAINER \
    psql -U \${POSTGRES_USER:-sigorta_user} -d \${POSTGRES_DB:-sigorta_hasar} -v ON_ERROR_STOP=1 -c \"$sql\""
}

echo "=== Gelen kutusu temizlik (received_at < $CUTOFF) — $REMOTE_HOST ==="

echo "--- Önce sayım ---"
remote_psql "SELECT mailbox, status, COUNT(*) AS adet FROM inbound_messages WHERE received_at < '$CUTOFF' GROUP BY mailbox, status ORDER BY 1, 2;"
remote_psql "SELECT COUNT(*) AS toplam_silinecek FROM inbound_messages WHERE received_at < '$CUTOFF';"

echo "--- DB yedeği ---"
ssh -o BatchMode=yes "$REMOTE_HOST" "cd \"$REMOTE_APP\" && bash scripts/pre-deploy-safety.sh inbox-purge-$(date +%Y%m%d) 2>&1 | tail -8"

echo "--- Silme (inbound_attachments cascade) ---"
remote_psql "DELETE FROM inbound_messages WHERE received_at < '$CUTOFF';"

echo "--- Sonra sayım ---"
remote_psql "SELECT COUNT(*) AS kalan_eski FROM inbound_messages WHERE received_at < '$CUTOFF';"
remote_psql "SELECT COUNT(*) AS toplam_1_temmuz_sonrasi FROM inbound_messages WHERE received_at >= '$CUTOFF';"

echo "=== Temizlik tamam ==="
