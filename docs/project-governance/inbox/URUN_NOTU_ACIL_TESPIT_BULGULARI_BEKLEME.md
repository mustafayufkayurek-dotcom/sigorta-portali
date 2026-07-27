# Ürün Notu — Acil Yardım Tespit Bulguları

**Tarih:** 2026-07-25  
**Karar sahibi:** Mustafa  
**Durum:** Beklemede — canlıya alınmayacak

## Karar

Acil Yardım dosyasına Hasar tarzı zorunlu **Tespit Bulguları** (`findingsText`) alanı local’de hazırlandı.

**Şimdi canlıya alınmayacak.**  
Acil Yardım tarafının **genel yenileme** aşamasına geçildiğinde bu iş pakete dahil edilip o zaman deploy edilecek.

## Kapsam (local / bekleyen)

- `emergency_cases.findings_text` migration
- Yeni dosya formunda zorunlu Tespit Bulguları (Hasar UI dili)
- Dosya detayında Tespit Bulguları → Dosya Bütçesi sırası (önce bulgu, sonra maliyet)
- Notlar ayrı ve opsiyonel kaldı
- Hasar tarafına dokunulmadı

## Deploy kuralı

Bu konu için **web / backend / migration deploy yok** — açık talimat gelene kadar bekler.
