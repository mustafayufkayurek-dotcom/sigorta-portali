-- AlterTable
ALTER TABLE "claim_files" ADD COLUMN     "claim_subject_id" TEXT;

-- CreateTable
CREATE TABLE "claim_subjects" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'hasar',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "claim_subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_department_memberships" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "role_scope" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_department_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claim_responsibility_assignments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "region_type" TEXT NOT NULL,
    "region_values" JSONB NOT NULL DEFAULT '[]',
    "coverage_type" TEXT NOT NULL DEFAULT 'all',
    "coverage_config" JSONB NOT NULL DEFAULT '{}',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "claim_responsibility_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "claim_subjects_code_key" ON "claim_subjects"("code");

-- CreateIndex
CREATE INDEX "claim_subjects_category_idx" ON "claim_subjects"("category");

-- CreateIndex
CREATE INDEX "claim_subjects_is_active_idx" ON "claim_subjects"("is_active");

-- CreateIndex
CREATE INDEX "user_department_memberships_user_id_idx" ON "user_department_memberships"("user_id");

-- CreateIndex
CREATE INDEX "user_department_memberships_department_id_idx" ON "user_department_memberships"("department_id");

-- CreateIndex
CREATE INDEX "user_department_memberships_is_primary_idx" ON "user_department_memberships"("is_primary");

-- CreateIndex
CREATE UNIQUE INDEX "user_department_memberships_user_id_department_id_key" ON "user_department_memberships"("user_id", "department_id");

-- CreateIndex
CREATE INDEX "claim_responsibility_assignments_user_id_idx" ON "claim_responsibility_assignments"("user_id");

-- CreateIndex
CREATE INDEX "claim_responsibility_assignments_department_id_idx" ON "claim_responsibility_assignments"("department_id");

-- CreateIndex
CREATE INDEX "claim_responsibility_assignments_region_type_idx" ON "claim_responsibility_assignments"("region_type");

-- CreateIndex
CREATE INDEX "claim_responsibility_assignments_priority_idx" ON "claim_responsibility_assignments"("priority");

-- CreateIndex
CREATE INDEX "claim_responsibility_assignments_is_active_idx" ON "claim_responsibility_assignments"("is_active");

-- AddForeignKey
ALTER TABLE "claim_files" ADD CONSTRAINT "claim_files_claim_subject_id_fkey" FOREIGN KEY ("claim_subject_id") REFERENCES "claim_subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_department_memberships" ADD CONSTRAINT "user_department_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_department_memberships" ADD CONSTRAINT "user_department_memberships_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_responsibility_assignments" ADD CONSTRAINT "claim_responsibility_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_responsibility_assignments" ADD CONSTRAINT "claim_responsibility_assignments_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
