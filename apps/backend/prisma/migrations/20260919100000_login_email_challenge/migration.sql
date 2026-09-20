-- Yönetici/finans giriş e-posta kodu. Mevcut oturumları silmez.
CREATE TABLE "login_email_challenges" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_email_challenges_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "login_email_challenges_user_id_idx" ON "login_email_challenges"("user_id");

ALTER TABLE "login_email_challenges" ADD CONSTRAINT "login_email_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
