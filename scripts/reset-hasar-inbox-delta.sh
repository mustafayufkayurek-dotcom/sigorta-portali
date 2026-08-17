#!/usr/bin/env bash
# HASAR gelen kutusu delta link sıfırlama + yeniden çekme tetikleme
# Kullanım (sunucuda): bash scripts/reset-hasar-inbox-delta.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/deploy-env.sh"

POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-sigorta-postgres}"

echo "=== HASAR gelen kutusu delta sıfırlama ==="

ssh -o BatchMode=yes "$REMOTE_HOST" "cd \"$REMOTE_APP\" && \
  set -a && source .env.production && set +a && \
  docker exec -e PGPASSWORD=\${POSTGRES_PASSWORD} $POSTGRES_CONTAINER \
    psql -U \${POSTGRES_USER:-sigorta_user} -d \${POSTGRES_DB:-sigorta_hasar} -v ON_ERROR_STOP=1 -c \"
      UPDATE graph_subscriptions
      SET delta_link = NULL, updated_at = NOW()
      WHERE subscription_id = 'delta-poll-HASAR';
      SELECT subscription_id, mailbox, delta_link IS NULL AS delta_cleared, updated_at
      FROM graph_subscriptions WHERE subscription_id = 'delta-poll-HASAR';
    \""

echo "=== Sync tetikle (admin token gerekir — panelden Gelen Kutusu → Senkronize Et de yeterli) ==="
echo "Delta sıfırlandı. Bir sonraki planlı sync (10 dk) veya manuel sync HASAR maillerini 1 Temmuz sonrasından yeniden tarar."
