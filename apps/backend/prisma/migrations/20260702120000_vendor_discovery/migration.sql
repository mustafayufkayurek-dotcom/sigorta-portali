-- CreateTable
CREATE TABLE "vendor_discovery_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "district" TEXT,
    "service_type" TEXT NOT NULL,
    "min_rating" DOUBLE PRECISION,
    "source" TEXT NOT NULL DEFAULT 'google_places',
    "result_count" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_discovery_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_discovery_candidates" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "rating" DOUBLE PRECISION,
    "review_count" INTEGER,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "source" TEXT NOT NULL,
    "raw_payload" JSONB,
    "imported_vendor_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_discovery_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vendor_discovery_sessions_user_id_created_at_idx" ON "vendor_discovery_sessions"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "vendor_discovery_candidates_session_id_idx" ON "vendor_discovery_candidates"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_discovery_candidates_session_id_external_id_key" ON "vendor_discovery_candidates"("session_id", "external_id");

-- AddForeignKey
ALTER TABLE "vendor_discovery_sessions" ADD CONSTRAINT "vendor_discovery_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_discovery_candidates" ADD CONSTRAINT "vendor_discovery_candidates_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "vendor_discovery_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_discovery_candidates" ADD CONSTRAINT "vendor_discovery_candidates_imported_vendor_id_fkey" FOREIGN KEY ("imported_vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
