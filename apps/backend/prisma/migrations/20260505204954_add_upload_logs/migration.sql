-- CreateTable
CREATE TABLE "upload_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT,
    "size" INTEGER,
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "upload_logs_pkey" PRIMARY KEY ("id")
);

-- RenameIndex
ALTER INDEX "damage_type_repair_templates_damage_type_work_sub_group_id_file" RENAME TO "damage_type_repair_templates_damage_type_work_sub_group_id__key";
