-- CreateTable
CREATE TABLE "screen_permissions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "screen_code" TEXT NOT NULL,
    "can_view" BOOLEAN NOT NULL DEFAULT true,
    "can_edit" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "screen_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "screen_permissions_user_id_idx" ON "screen_permissions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "screen_permissions_user_id_screen_code_key" ON "screen_permissions"("user_id", "screen_code");

-- AddForeignKey
ALTER TABLE "screen_permissions" ADD CONSTRAINT "screen_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
