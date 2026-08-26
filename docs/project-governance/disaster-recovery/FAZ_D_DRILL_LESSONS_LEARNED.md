# FAZ D — Tatbikat Dersleri

**Tarih:** 2026-08-17  
**Kaynak:** Laptop izole deneme (`FAZ_D_DRILL_RESULT.md`). Production / B2 yazma yok.

## Bulgu

Tatbikat sırasında uygulama kurtarma başlamadan önce B2 erişim bilgilerinin operasyonel olarak mevcut olmadığı görüldü.

- GitHub tag `production-v505-2026-08-17` (`04d52b8`) alındı.  
- Docker Desktop + `postgres:16-alpine` (ağ yok) ayağa kalktı.  
- Host’ta `rclone` ve kasa kopyası yoktu. Production secret kullanılmadı.  
- Dump / uploads indirilemedi. Restore, build, login ve RTO ölçülmedi.

Bu bir ürün hatası değil; **VPS dışı kasa boş** iken DR’nin durması beklenen kilittir.

## Düzeltici aksiyon

1. Secret Vault kurulumu (`SECRET_VAULT_DESIGN.md` + `SECRET_VAULT_SETUP_CHECKLIST.md`) — değerler git’e girmez.  
2. B2 erişim listesi doldurulur (`B2_ACCESS_RECOVERY_CHECKLIST.md`) — komutlar örnek; doldurulana kadar çalıştırılmaz.  
3. Gerçek **ayrı DR VPS** tatbikatı, Ön Koşullar yeşil olduktan sonra (`RECOVERY_DRILL_PLAN.md`) — canlı DNS/B2 silme yok.  
4. O tatbikatta `RTO_MEASUREMENT.md` doldurulur.

Vault `☑` olmadan FAZ D tekrarı aynı blokajla biter.
