# Canlı Kabul Protokolü (Kalıcı)

## Kim PASS verir?

Yalnızca **Mustafa**. Agent veya otomatik checklist PASS yazamaz.

## Agent yasakları

- «41 madde canlıda» / «tamamlandı» / todo completed **Mustafa PASS olmadan**
- Agent türetimi checklist'i Mustafa notlarının yerine koymak
- Toplu madde testi sırasında deploy iddiası

## Test sırası

1. Footer: **Web v???** — manifest ile aynı olmalı
2. Doğru ekran (dosya detay vs Rapora Git sonrası rapor)
3. Madde madde: **OLMUŞ / OLMAMIŞ / YANLIŞ / YENİ TALEP**
4. Kayıt: `ONARIM_RAPORU_MUSTAFA_KABUL_YYYYMMDD.md`

## Deploy öncesi

- `docs/project-governance/DEPLOY_GUVENLIK_PROTOKOLU.md`
- `scripts/pre-deploy-safety.sh ETİKET`
- Scope: **web-only / backend-only / full** + rollback tag mesajda

## Veri kaybı önleme

- Rapor satırı: full page reload yerine satır güncelleme (regresyon kontrolü)
- Fotoğraf yükleme: başarısızsa sayfa yenileme yok
- Eksper: dosya sorumlusu asla Dosya Eksperi alanında gösterilmez
- Migration: backend deploy öncesi DB yedeği zorunlu

## Tek kaynak geri bildirim

Mustafa'nın orijinal notları ve «OLMUŞ/OLMAMIŞ» mesajları — `ONARIM_RAPORU_MUSTAFA_KABUL_*.md`
