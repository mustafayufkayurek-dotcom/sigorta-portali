# Sprint 2 Migration Rollback Planı

**Tarih:** 6 Mayıs 2026  
**Migration:** `20260506_add_timeline_sla_waiting` + `20260506_sprint2_consultant_additions`

---

## Rollback SQL (Ters sırada çalıştırılır)

### Migration 2 Rollback (consultant_additions)
```sql
-- TimelineNote tablosunu kaldır
ALTER TABLE "timeline_notes" DROP CONSTRAINT "timeline_notes_claim_file_id_fkey";
ALTER TABLE "timeline_notes" DROP CONSTRAINT "timeline_notes_author_id_fkey";
DROP INDEX "timeline_notes_claim_file_id_idx";
DROP TABLE "timeline_notes";

-- ClaimFile ek alanları kaldır
DROP INDEX "claim_files_last_activity_at_idx";
DROP INDEX "claim_files_current_responsible_user_id_idx";
ALTER TABLE "claim_files" DROP COLUMN "current_responsible_role";
ALTER TABLE "claim_files" DROP COLUMN "current_responsible_user_id";
ALTER TABLE "claim_files" DROP COLUMN "pending_action_owner";
ALTER TABLE "claim_files" DROP COLUMN "last_activity_at";
ALTER TABLE "claim_files" DROP COLUMN "last_human_action_at";

-- ClaimStatus SLA alanları kaldır
ALTER TABLE "claim_statuses" DROP COLUMN "sla_warning_percent";
ALTER TABLE "claim_statuses" DROP COLUMN "sla_critical_percent";
ALTER TABLE "claim_statuses" DROP COLUMN "sla_escalation_percent";
```

### Migration 1 Rollback (timeline_sla_waiting)
```sql
-- ClaimFileWaiting tablosunu kaldır
ALTER TABLE "claim_file_waitings" DROP CONSTRAINT "claim_file_waitings_claim_file_id_fkey";
ALTER TABLE "claim_file_waitings" DROP CONSTRAINT "claim_file_waitings_created_by_user_id_fkey";
ALTER TABLE "claim_file_waitings" DROP CONSTRAINT "claim_file_waitings_resolved_by_user_id_fkey";
DROP INDEX "claim_file_waitings_claim_file_id_idx";
DROP TABLE "claim_file_waitings";

-- ClaimStatusHistory ek alanları kaldır
ALTER TABLE "claim_status_history" DROP COLUMN "duration_minutes";
ALTER TABLE "claim_status_history" DROP COLUMN "waiting_reason";

-- ClaimStatus ek alanları kaldır
ALTER TABLE "claim_statuses" DROP COLUMN "max_duration_hours";
ALTER TABLE "claim_statuses" DROP COLUMN "is_waiting_state";
```

---

## Rollback Prosedürü

1. Backend container'ı durdur: `docker stop sigorta-backend`
2. Rollback SQL çalıştır: `docker exec sigorta-postgres psql -U postgres -d sigorta_db -f /tmp/rollback.sql`
3. Eski backend image'ı deploy et: `docker start sigorta-backend` (önceki image tag)
4. Doğrulama: `curl https://app.meridyen-tr.com/api/v1/health`

## Risk Değerlendirmesi

- **Veri kaybı riski:** DÜŞÜK — Yeni tablolar/kolonlar ekleniyor, mevcut veri değişmiyor
- **Downtime:** ~2 dakika (migration + restart)
- **Geri dönüş süresi:** ~3 dakika (rollback SQL + restart)

## Karar Kriteri

Rollback SADECE şu durumlarda uygulanır:
- Migration sonrası mevcut endpoint'ler 500 dönüyorsa
- Login/yetkilendirme çalışmıyorsa
- Dashboard verileri kaybolmuşsa
