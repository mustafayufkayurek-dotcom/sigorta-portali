-- Meridyen operasyon branşları: scope customer → meridyen (tedarikçi scope=vendor ayrı kalır)
UPDATE "service_branches" SET "scope" = 'meridyen' WHERE "scope" = 'customer';

ALTER TABLE "service_branches" ALTER COLUMN "scope" SET DEFAULT 'meridyen';
