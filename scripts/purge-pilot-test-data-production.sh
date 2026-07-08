#!/usr/bin/env bash
# Pilot/test operasyon verisi — YALNIZCA test işaretli kayıtlar (gerçek veri korumalı)
#
# Önizleme (varsayılan):
#   bash scripts/purge-pilot-test-data-production.sh
#
# Gerçek silme (çok dikkatli — Mustafa onayı):
#   CONFIRM_PURGE=YES DRY_RUN=0 PURGE_ALLOW=EXPLICIT_TEST_MARKERS_ONLY \
#     bash scripts/purge-pilot-test-data-production.sh
#
# PRODUCTION_DATA_PROTECTED=true iken PURGE_SCOPE=all ÇALIŞMAZ.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/deploy-env.sh"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/purge-safety.sh"

POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-sigorta-postgres}"
PURGE_TAG="pilot-test-purge-$(date +%Y%m%d)"
MAINTENANCE_STARTED=0

cleanup_maintenance() {
  if [ "$MAINTENANCE_STARTED" = "1" ] && [ "$DRY_RUN" != "1" ]; then
    echo "--- Bakım modu kapatılıyor ---"
    bash "$SCRIPT_DIR/set-maintenance-mode.sh" off || purge_warn "Bakım modu kapatılamadı — manuel kontrol edin"
  fi
}
trap cleanup_maintenance EXIT

remote_psql() {
  local sql="$1"
  ssh -o BatchMode=yes "$REMOTE_HOST" "cd \"$REMOTE_APP\" && \
    set -a && source .env.production 2>/dev/null && set +a && \
    docker exec -e PGPASSWORD=\${POSTGRES_PASSWORD} $POSTGRES_CONTAINER \
    psql -U \${POSTGRES_USER:-sigorta_user} -d \${POSTGRES_DB:-sigorta_hasar} -v ON_ERROR_STOP=1 -c \"$sql\""
}

remote_psql_multiline() {
  ssh -o BatchMode=yes "$REMOTE_HOST" "cd \"$REMOTE_APP\" && set -a && source .env.production && set +a && \
    docker exec -i -e PGPASSWORD=\${POSTGRES_PASSWORD} $POSTGRES_CONTAINER \
    psql -U \${POSTGRES_USER:-sigorta_user} -d \${POSTGRES_DB:-sigorta_hasar} -v ON_ERROR_STOP=1"
}

purge_load_production_guard_from_remote "$REMOTE_HOST" "$REMOTE_APP"
purge_print_banner
purge_assert_safe_to_run

TX_END="ROLLBACK;"
if [ "$DRY_RUN" != "1" ] && [ "$CONFIRM_PURGE" = "YES" ]; then
  TX_END="COMMIT;"
fi

echo "=== Pilot test veri temizliği — $REMOTE_HOST (DRY_RUN=$DRY_RUN, PURGE_SCOPE=$PURGE_SCOPE) ==="

echo "--- Mevcut sayım ---"
remote_psql "SELECT 'claim_files' t, count(*) FROM claim_files
UNION ALL SELECT 'emergency_cases', count(*) FROM emergency_cases
UNION ALL SELECT 'customers', count(*) FROM customers
UNION ALL SELECT 'vendors', count(*) FROM vendors
UNION ALL SELECT 'expenses', count(*) FROM expenses;"

echo "--- Önizleme: silinecek / korunan kayıtlar ---"
remote_psql "SELECT 'SİLİNECEK claim_files' AS kategori, file_no AS etiket FROM claim_files WHERE
  file_no ~* '^(EXP-|P7B?-?HASAR)'
  OR file_no IN ('123456789','242424','778899','44556677')
  OR COALESCE(description,'') ~* '(pilot|audit|test)'
ORDER BY 2 LIMIT 50;"

remote_psql "SELECT 'KORUNAN claim_files' AS kategori, file_no AS etiket FROM claim_files WHERE NOT (
  file_no ~* '^(EXP-|P7B?-?HASAR)'
  OR file_no IN ('123456789','242424','778899','44556677')
  OR COALESCE(description,'') ~* '(pilot|audit|test)'
) ORDER BY 2 LIMIT 50;"

remote_psql "SELECT 'SİLİNECEK customers' AS kategori,
  COALESCE(company_name, full_name, first_name || ' ' || last_name, id::text) AS etiket
FROM customers WHERE (
  COALESCE(company_name,'') ~* '(test|pilot|audit|p7b)'
  OR COALESCE(full_name,'') ~* '(test|pilot|audit|p7b)'
  OR COALESCE(first_name,'') ~* '(test|pilot|audit)'
) AND created_at < NOW() - INTERVAL '${EXCLUDE_RECENT_HOURS} hours'
ORDER BY 2 LIMIT 50;"

remote_psql "SELECT 'KORUNAN customers (son ${EXCLUDE_RECENT_HOURS}s veya test işareti yok)' AS kategori,
  COALESCE(company_name, full_name, first_name || ' ' || last_name, id::text) AS etiket
FROM customers WHERE NOT (
  (COALESCE(company_name,'') ~* '(test|pilot|audit|p7b)'
   OR COALESCE(full_name,'') ~* '(test|pilot|audit|p7b)'
   OR COALESCE(first_name,'') ~* '(test|pilot|audit)')
  AND created_at < NOW() - INTERVAL '${EXCLUDE_RECENT_HOURS} hours'
) ORDER BY 2 LIMIT 50;"

remote_psql "SELECT 'SİLİNECEK vendors' AS kategori, name AS etiket FROM vendors WHERE (
  name ~* '(test|pilot|audit|D317|P5354)'
) AND created_at < NOW() - INTERVAL '${EXCLUDE_RECENT_HOURS} hours'
ORDER BY 2 LIMIT 50;"

PURGE_SQL=$(cat <<SQL
BEGIN;

-- Test işaretli hasar dosyaları
CREATE TEMP TABLE _purge_cf ON COMMIT DROP AS
SELECT id FROM claim_files WHERE
  file_no ~* '^(EXP-|P7B?-?HASAR)'
  OR file_no IN ('123456789','242424','778899','44556677')
  OR COALESCE(description,'') ~* '(pilot|audit|test)';

-- Test acil yardım
CREATE TEMP TABLE _purge_ec ON COMMIT DROP AS
SELECT id FROM emergency_cases WHERE
  case_no ~* '^AY-202606'
  OR COALESCE(customer_name,'') ~* '(test|pilot|audit|p7b)'
  OR COALESCE(notes,'') ~* '(test|pilot|audit)';

-- Yalnızca açık test isimli müşteriler (son ${EXCLUDE_RECENT_HOURS} saat korunur)
CREATE TEMP TABLE _purge_cu ON COMMIT DROP AS
SELECT id FROM customers WHERE (
  COALESCE(company_name,'') ~* '(test|pilot|audit|p7b)'
  OR COALESCE(full_name,'') ~* '(test|pilot|audit|p7b)'
  OR COALESCE(first_name,'') ~* '(test|pilot|audit)'
) AND created_at < NOW() - INTERVAL '${EXCLUDE_RECENT_HOURS} hours';

-- Test tedarikçiler
CREATE TEMP TABLE _purge_ve ON COMMIT DROP AS
SELECT id FROM vendors WHERE (
  name ~* '(test|pilot|audit|D317|P5354)'
) AND created_at < NOW() - INTERVAL '${EXCLUDE_RECENT_HOURS} hours';

SELECT 'HEDEF claim_files' AS step, count(*)::bigint AS n FROM _purge_cf;
SELECT 'HEDEF emergency_cases' AS step, count(*)::bigint AS n FROM _purge_ec;
SELECT 'HEDEF customers' AS step, count(*)::bigint AS n FROM _purge_cu;
SELECT 'HEDEF vendors' AS step, count(*)::bigint AS n FROM _purge_ve;

WITH d AS (DELETE FROM expenses WHERE file_case_id IN (SELECT id FROM _purge_cf) RETURNING 1) SELECT 'DEL expenses' AS step, count(*)::bigint AS n FROM d;
WITH d AS (DELETE FROM vendor_contracts WHERE claim_file_id IN (SELECT id FROM _purge_cf) OR vendor_id IN (SELECT id FROM _purge_ve) RETURNING 1) SELECT 'DEL vendor_contracts' AS step, count(*)::bigint AS n FROM d;
WITH d AS (DELETE FROM customer_access_logs WHERE claim_file_id IN (SELECT id FROM _purge_cf) OR customer_id IN (SELECT id FROM _purge_cu) RETURNING 1) SELECT 'DEL customer_access_logs' AS step, count(*)::bigint AS n FROM d;
WITH d AS (DELETE FROM emergency_invoice_items WHERE case_id IN (SELECT id FROM _purge_ec) RETURNING 1) SELECT 'DEL emergency_invoice_items' AS step, count(*)::bigint AS n FROM d;
WITH d AS (DELETE FROM emergency_cost_entries WHERE case_id IN (SELECT id FROM _purge_ec) RETURNING 1) SELECT 'DEL emergency_cost_entries' AS step, count(*)::bigint AS n FROM d;
WITH d AS (DELETE FROM invoice_requests WHERE claim_file_id IN (SELECT id FROM _purge_cf) OR emergency_case_id IN (SELECT id FROM _purge_ec) RETURNING 1) SELECT 'DEL invoice_requests' AS step, count(*)::bigint AS n FROM d;
WITH d AS (DELETE FROM file_documents WHERE claim_file_id IN (SELECT id FROM _purge_cf) OR emergency_case_id IN (SELECT id FROM _purge_ec) RETURNING 1) SELECT 'DEL file_documents' AS step, count(*)::bigint AS n FROM d;
UPDATE inbound_messages SET claim_file_id = NULL WHERE claim_file_id IN (SELECT id FROM _purge_cf);
UPDATE inbound_messages SET emergency_case_id = NULL WHERE emergency_case_id IN (SELECT id FROM _purge_ec);
WITH d AS (DELETE FROM emergency_cases WHERE id IN (SELECT id FROM _purge_ec) RETURNING 1) SELECT 'DEL emergency_cases' AS step, count(*)::bigint AS n FROM d;
WITH d AS (DELETE FROM claim_files WHERE id IN (SELECT id FROM _purge_cf) RETURNING 1) SELECT 'DEL claim_files' AS step, count(*)::bigint AS n FROM d;
UPDATE repair_reports SET expert_office_id = NULL WHERE expert_office_id IN (SELECT id FROM _purge_cu);
WITH d AS (DELETE FROM contact_infos WHERE customer_id IN (SELECT id FROM _purge_cu) OR vendor_id IN (SELECT id FROM _purge_ve) RETURNING 1) SELECT 'DEL contact_infos' AS step, count(*)::bigint AS n FROM d;
WITH d AS (DELETE FROM customers WHERE id IN (SELECT id FROM _purge_cu) RETURNING 1) SELECT 'DEL customers' AS step, count(*)::bigint AS n FROM d;
UPDATE vendor_discovery_candidates SET imported_vendor_id = NULL WHERE imported_vendor_id IN (SELECT id FROM _purge_ve);
WITH d AS (DELETE FROM vendors WHERE id IN (SELECT id FROM _purge_ve) RETURNING 1) SELECT 'DEL vendors' AS step, count(*)::bigint AS n FROM d;

SELECT 'AFTER claim_files' AS phase, count(*)::bigint AS n FROM claim_files;
SELECT 'AFTER emergency_cases' AS phase, count(*)::bigint AS n FROM emergency_cases;
SELECT 'AFTER customers' AS phase, count(*)::bigint AS n FROM customers;
SELECT 'AFTER vendors' AS phase, count(*)::bigint AS n FROM vendors;
SELECT 'AFTER expenses' AS phase, count(*)::bigint AS n FROM expenses;
$TX_END
SQL
)

if [ "$DRY_RUN" != "1" ] && [ "$CONFIRM_PURGE" = "YES" ]; then
  echo "--- Bakım modu açılıyor ---"
  bash "$SCRIPT_DIR/set-maintenance-mode.sh" on
  MAINTENANCE_STARTED=1
  echo "--- DB yedeği (pre-deploy-safety) ---"
  ssh -o BatchMode=yes "$REMOTE_HOST" "cd \"$REMOTE_APP\" && bash scripts/pre-deploy-safety.sh $PURGE_TAG 2>&1 | tail -12"
fi

echo "--- Silme (${TX_END%;*}) ---"
printf '%s\n' "$PURGE_SQL" | remote_psql_multiline

echo "=== Tamamlandı (DRY_RUN=$DRY_RUN) ==="
