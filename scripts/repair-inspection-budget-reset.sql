-- Hasar Tespit dosyasında rapor toplamı tespit edilen hasardır; bütçe / beklenen gelir değildir.
-- syncClaimFromLatestReport bu alanlara rapor toplamını yazmıştı (Yönetim Paneli planRevenue şişiyordu).
-- Gelir kaydı (claim_file_revenues) ve fatura dokunulmaz. Idempotent.

BEGIN;

UPDATE claim_files
SET approved_budget_amount = NULL,
    estimated_cost_amount = NULL,
    profit_amount = NULL
WHERE service_kind = 'inspection'
  AND (approved_budget_amount IS NOT NULL
    OR estimated_cost_amount IS NOT NULL
    OR profit_amount IS NOT NULL);

UPDATE claim_financial_summaries fs
SET estimated_revenue = 0,
    estimated_cost = 0
FROM claim_files cf
WHERE cf.id = fs.claim_file_id
  AND cf.service_kind = 'inspection'
  AND (coalesce(fs.estimated_revenue, 0) <> 0 OR coalesce(fs.estimated_cost, 0) <> 0);

COMMIT;
