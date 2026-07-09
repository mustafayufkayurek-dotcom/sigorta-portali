# Meridyen AI Governance — Kaynak İndeksi

**Sürüm:** 1.0  
**Son güncelleme:** 2026-07-09  
**Cursor kuralı:** `.cursor/rules/ai-governance.mdc` (alwaysApply)

Bu indeks, masaüstündeki kaynak belgeler ile repodaki uygulanan kuralı eşler.

---

## Kaynak belgeler (Mustafa arşivi)

| Belge | Dosya |
|-------|--------|
| AI Engineering & Product Governance Standard v1.0 | `MERIDYEN_AI_ENGINEERING_PRODUCT_GOVERNANCE_STANDARD_v1.0.docx` |
| AI Software Engineering Constitution v1.0 | `MERIDYEN_AI_SOFTWARE_ENGINEERING_CONSTITUTION_v1.0.docx` |

Kaynak `.docx` dosyaları repoya kopyalanmaz; güncelleme gerektiğinde Mustafa yeni sürümü paylaşır, agent `.cursor/rules/ai-governance.mdc` dosyasını senkronlar.

---

## Uygulama katmanları

| Katman | Dosya | Kapsam |
|--------|-------|--------|
| AI Governance (üst çerçeve) | `.cursor/rules/ai-governance.mdc` | Rol, regresyon, kırmızı çizgiler, teslim |
| Deploy güvenliği | `.cursor/rules/deploy-guvenlik.mdc` | Canlı deploy, rollback, smoke |
| UI metinleri | `.cursor/rules/turkce-yazim-kulturu.mdc` | Title Case, dosya terimi |
| Türkçe iletişim | `.cursor/rules/turkce-sesli-giris.mdc` | Sesli giriş, yanıt dili |
| Proje anayasası | `docs/project-governance/00_PROJE_ANAYASASI.md` | Ürün kararı > kod |
| Deploy protokolü | `docs/project-governance/DEPLOY_GUVENLIK_PROTOKOLU.md` | Operasyonel deploy adımları |

---

## Temel cümle (anayasa)

Amaç daha fazla kod üretmek değil; daha az hata üretmek, mevcut ürünü korumak ve kurumsal kaliteyi sürdürülebilir hale getirmektir.

---

## Revizyon kuralı

| Sürüm | Ne zaman? |
|-------|-----------|
| v1.0 | İlk Cursor rule + indeks (2026-07-09) |
| v1.1 | Kaynak docx güncellenince rule senkronu |
| v2.0 | UI standartları, regresyon checklist, test matrisi eklendiğinde |
