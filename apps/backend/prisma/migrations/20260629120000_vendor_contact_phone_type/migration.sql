-- AlterTable
ALTER TABLE "vendor_contacts" ADD COLUMN     "phone_type" TEXT NOT NULL DEFAULT 'gsm',
ADD COLUMN     "phone_extension" TEXT;
