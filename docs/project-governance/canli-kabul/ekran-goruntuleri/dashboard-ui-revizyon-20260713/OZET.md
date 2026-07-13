# Dashboard UI Revizyon — Tasarım Teslimi (2026-07-13)

**Durum:** Yalnızca tasarım. Kod / deploy / API / backend yok.  
**Amaç:** Madde 17’ye uygun wireframe + mockup onayı; onay sonrası uygulama.

## Mockup dosyaları

| # | Dosya | İçerik |
|---|--------|--------|
| 1 | `01-wireframe-desktop.png` | Desktop wireframe — layout, Help → Right Drawer, hiyerarşi notları |
| 2 | `02-desktop-hifi-mockup.png` | Desktop hi-fi — kurumsal Dynamics/Salesforce dili, drawer açık |
| 3 | `03-tablet-mockup.png` | Tablet — sidebar 72px ikon, drawer + resize handle |
| 4 | `04-mobil-mockup.png` | Mobil — kalıcı panel yok, Help → Drawer overlay |

Klasör: `docs/project-governance/canli-kabul/ekran-goruntuleri/dashboard-ui-revizyon-20260713/`

---

## Ne değişir (UI / UX)

1. **Kalıcı sağ Kullanım Kılavuzu paneli kalkar** — dashboard tam genişlik kullanır.
2. **Yardım:** Top Bar 📖 **Right Drawer** (aç/kapa, resizeable, açık/kapalı ve genişlik hatırlanır).
3. **Drawer sekmeleri:** Başlangıç | Video | PDF | SSS | Sürüm Notları | İletişim + arama.
4. **Sol menü Yardım / Top Bar Help** aynı drawer’ı açar.
5. **Top Bar sırası:** ☰ Logo | Global Search | Quick Actions | Notification | Help | Theme | User | System Status.
6. **Logo:** Header 48–56px SVG; sidebar açık ~180–220px SVG wordmark; kapalı yalnız SVG ikon; **PNG yok**.
7. **Sidebar:** Açık ~240px / kapalı ~72px; kapalıda tooltip; aktif = mavi çizgi + bg + bold.
8. **KPI:** Rakam > başlık; kart arası gap 16–24px.
9. **İçerik hiyerarşisi:** Logo → Başlık → KPI → Operasyon → Haftalık → Günün Akışı.
10. Görsel dil: kurumsal mavi/slate; purple glow / amatör efekt yok.

## Ne değişmez

- **API / backend / Prisma / migration yok** — bu turda yalnızca ekran düzeni.
- Mevcut **dashboard veri kaynakları, KPI hesapları, roller, yetkiler, filtreler, linkler** mantıken aynı kalır; yalnızca yerleşim ve kabuk değişir.
- Mevcut **fonksiyonlar korunur** (global arama, hızlı işlem, bildirim, tema, kullanıcı menüsü, sistem durumu, operasyon özeti, haftalık performans, günün akışı vb.) — kaldırılan tek şey kalıcı sağ yardım/reklam paneli; içerik drawer’a taşınır.
- Deploy bu onay sonrası ayrı karar.

## Onay

Onay verirsen uygulama turuna geçilir.  
Düzeltme notu yazarsan mockup güncellenir; kod yazılmaz.
