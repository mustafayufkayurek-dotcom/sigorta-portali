-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "address" TEXT,
ADD COLUMN     "authorized_person" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "district" TEXT,
ADD COLUMN     "entity_type" TEXT NOT NULL DEFAULT 'individual',
ADD COLUMN     "first_name" TEXT,
ADD COLUMN     "follow_up_date" TIMESTAMP(3),
ADD COLUMN     "last_name" TEXT,
ADD COLUMN     "satisfaction_score" INTEGER,
ADD COLUMN     "source" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active',
ADD COLUMN     "sub_type" TEXT,
ADD COLUMN     "tags" JSONB DEFAULT '[]',
ADD COLUMN     "tax_office" TEXT;

-- AlterTable
ALTER TABLE "vendors" ADD COLUMN     "source" TEXT,
ADD COLUMN     "tags" JSONB DEFAULT '[]';

-- CreateTable
CREATE TABLE "vendor_contacts" (
    "id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "title" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "birth_date" TIMESTAMP(3),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_infos" (
    "id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'general',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "vendor_id" TEXT,
    "customer_id" TEXT,

    CONSTRAINT "contact_infos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vendor_contacts_vendor_id_idx" ON "vendor_contacts"("vendor_id");

-- CreateIndex
CREATE INDEX "contact_infos_entity_type_entity_id_idx" ON "contact_infos"("entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "vendor_contacts" ADD CONSTRAINT "vendor_contacts_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_infos" ADD CONSTRAINT "contact_infos_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_infos" ADD CONSTRAINT "contact_infos_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
