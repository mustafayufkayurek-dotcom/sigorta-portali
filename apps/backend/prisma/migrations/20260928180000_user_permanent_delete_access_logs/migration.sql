-- Personel kalıcı silinince müşteri erişim izi kaydı silmeyi kesmesin.
ALTER TABLE "customer_access_logs" DROP CONSTRAINT "customer_access_logs_user_id_fkey";
ALTER TABLE "customer_access_logs" ADD CONSTRAINT "customer_access_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
