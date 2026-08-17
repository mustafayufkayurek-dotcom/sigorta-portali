-- Platform modül pod altyapısı + personel/demirbaş iskelet tabloları

CREATE TABLE "platform_modules" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_enabled" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "config" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_modules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_modules_code_key" ON "platform_modules"("code");

CREATE TABLE "hr_employee_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "personnel_no" TEXT,
    "payroll_employer_name" TEXT,
    "employment_type" TEXT NOT NULL DEFAULT 'indefinite',
    "hire_date" DATE,
    "termination_date" DATE,
    "department_id" TEXT,
    "manager_user_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_employee_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "hr_employee_profiles_user_id_key" ON "hr_employee_profiles"("user_id");
CREATE UNIQUE INDEX "hr_employee_profiles_personnel_no_key" ON "hr_employee_profiles"("personnel_no");
CREATE INDEX "hr_employee_profiles_status_idx" ON "hr_employee_profiles"("status");
CREATE INDEX "hr_employee_profiles_department_id_idx" ON "hr_employee_profiles"("department_id");

CREATE TABLE "hr_attendance_entries" (
    "id" TEXT NOT NULL,
    "employee_profile_id" TEXT NOT NULL,
    "work_date" DATE NOT NULL,
    "minutes_worked" INTEGER,
    "entry_type" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "notes" TEXT,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_attendance_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "hr_attendance_entries_employee_profile_id_work_date_entry_type_key" ON "hr_attendance_entries"("employee_profile_id", "work_date", "entry_type");
CREATE INDEX "hr_attendance_entries_work_date_idx" ON "hr_attendance_entries"("work_date");

CREATE TABLE "hr_leave_requests" (
    "id" TEXT NOT NULL,
    "employee_profile_id" TEXT NOT NULL,
    "leave_type" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reason" TEXT,
    "approved_by_user_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_leave_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "hr_leave_requests_employee_profile_id_idx" ON "hr_leave_requests"("employee_profile_id");
CREATE INDEX "hr_leave_requests_status_idx" ON "hr_leave_requests"("status");

CREATE TABLE "hr_documents" (
    "id" TEXT NOT NULL,
    "employee_profile_id" TEXT,
    "document_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "file_name" TEXT,
    "storage_key" TEXT,
    "content_hash" TEXT,
    "requires_signature" BOOLEAN NOT NULL DEFAULT false,
    "signed_at" TIMESTAMP(3),
    "signed_by_user_id" TEXT,
    "signature_meta" JSONB,
    "archived_at" TIMESTAMP(3),
    "uploaded_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "hr_documents_employee_profile_id_idx" ON "hr_documents"("employee_profile_id");
CREATE INDEX "hr_documents_document_type_idx" ON "hr_documents"("document_type");

CREATE TABLE "fixed_assets" (
    "id" TEXT NOT NULL,
    "asset_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "serial_number" TEXT,
    "purchase_date" DATE,
    "assigned_employee_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "location" TEXT,
    "notes" TEXT,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fixed_assets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fixed_assets_asset_code_key" ON "fixed_assets"("asset_code");
CREATE INDEX "fixed_assets_status_idx" ON "fixed_assets"("status");

ALTER TABLE "hr_employee_profiles" ADD CONSTRAINT "hr_employee_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hr_employee_profiles" ADD CONSTRAINT "hr_employee_profiles_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "hr_employee_profiles" ADD CONSTRAINT "hr_employee_profiles_manager_user_id_fkey" FOREIGN KEY ("manager_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "hr_attendance_entries" ADD CONSTRAINT "hr_attendance_entries_employee_profile_id_fkey" FOREIGN KEY ("employee_profile_id") REFERENCES "hr_employee_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "hr_leave_requests" ADD CONSTRAINT "hr_leave_requests_employee_profile_id_fkey" FOREIGN KEY ("employee_profile_id") REFERENCES "hr_employee_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "hr_documents" ADD CONSTRAINT "hr_documents_employee_profile_id_fkey" FOREIGN KEY ("employee_profile_id") REFERENCES "hr_employee_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "hr_documents" ADD CONSTRAINT "hr_documents_signed_by_user_id_fkey" FOREIGN KEY ("signed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "hr_documents" ADD CONSTRAINT "hr_documents_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "fixed_assets" ADD CONSTRAINT "fixed_assets_assigned_employee_id_fkey" FOREIGN KEY ("assigned_employee_id") REFERENCES "hr_employee_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "platform_modules" ("id", "code", "name", "description", "is_enabled", "sort_order", "config", "updated_at")
VALUES
  ('pod-personnel-v1', 'personnel', 'Personel Modülü', 'Puantaj, izin, hizmet kayıtları, dijital evrak arşivi', false, 10, '{}', CURRENT_TIMESTAMP),
  ('pod-fixed-assets-v1', 'fixed_assets', 'Demirbaş Modülü', 'Demirbaş takibi ve personele zimmet', false, 20, '{}', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
