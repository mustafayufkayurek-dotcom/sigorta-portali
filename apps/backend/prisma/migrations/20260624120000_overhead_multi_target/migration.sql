-- Yönetim gideri dağıtımı: acil yardım hedefleri + danışmanlık hariç çoklu dosya türü

ALTER TABLE "overhead_allocations" ALTER COLUMN "claim_file_id" DROP NOT NULL;

ALTER TABLE "overhead_allocations" ADD COLUMN "emergency_case_id" TEXT;
ALTER TABLE "overhead_allocations" ADD COLUMN "emergency_cost_entry_id" TEXT;

ALTER TABLE "emergency_cost_entries" ADD COLUMN "is_overhead" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "emergency_cost_entries" ADD COLUMN "source" TEXT;
ALTER TABLE "emergency_cost_entries" ADD COLUMN "expense_category_id" TEXT;

CREATE UNIQUE INDEX "overhead_allocations_emergency_cost_entry_id_key"
  ON "overhead_allocations"("emergency_cost_entry_id");

CREATE INDEX "overhead_allocations_emergency_case_id_idx"
  ON "overhead_allocations"("emergency_case_id");

CREATE INDEX "emergency_cost_entries_is_overhead_idx"
  ON "emergency_cost_entries"("is_overhead");

ALTER TABLE "overhead_allocations"
  ADD CONSTRAINT "overhead_allocations_emergency_case_id_fkey"
  FOREIGN KEY ("emergency_case_id") REFERENCES "emergency_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "overhead_allocations"
  ADD CONSTRAINT "overhead_allocations_emergency_cost_entry_id_fkey"
  FOREIGN KEY ("emergency_cost_entry_id") REFERENCES "emergency_cost_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "emergency_cost_entries"
  ADD CONSTRAINT "emergency_cost_entries_expense_category_id_fkey"
  FOREIGN KEY ("expense_category_id") REFERENCES "expense_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
