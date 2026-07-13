-- Onarım raporu revizyon numaralandırması: 1-based → 0-based (0..3; 4. revizyon yok)
UPDATE "repair_reports" SET "version_no" = "version_no" - 1 WHERE "version_no" > 0;
ALTER TABLE "repair_reports" ALTER COLUMN "version_no" SET DEFAULT 0;
