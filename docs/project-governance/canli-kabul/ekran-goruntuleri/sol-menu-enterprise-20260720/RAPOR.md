# Sol Menü Enterprise — Lokal Teslim (2026-07-20)

## Referans
- `00-referans-sol-menu.png` (`Ekran_Resmi_2026-07-20_22.30.40`)
- Talimat paneli ürün UI değildir; ölçü/stil bağlayıcıdır.

## Uygulanan
| Madde | Değer |
|-------|--------|
| Açık | 260px HARD |
| Kapalı | 72px HARD + tooltip |
| Padding | px-16 (4) / py 12–16 |
| Metin | 15px / 500 |
| İkon | 20px |
| Aktif | bg `#EEF2FF` · ikon `#2563EB` · yazı `#1E40AF` |
| Hover | bg `#F3F4F6` |
| Badge | `#EF4444` |
| Grup arası | +8px |
| Logo | yalnız topbar (RC1 — sidebar’da yok) |

## Ölçüm (Playwright / Chrome channel)
- Expanded width: **260px**
- Collapsed width: **72px**
- Active bg: `rgb(238, 242, 255)` = `#EEF2FF`
- Active text: `rgb(30, 64, 175)` = `#1E40AF`
- Font: 15px / 500
- Icon: 20×20, color `#2563EB`

## Kanıt
- `01-lokal-expanded-1440.png`
- `02-sidebar-expanded-closeup.png`
- `03-lokal-collapsed-1440.png`
- `04-sidebar-collapsed-closeup.png`

## Dosyalar
- `apps/web/src/config/panel-layout-spacing.ts`
- `apps/web/src/app/globals.css`
- `apps/web/src/app/panel/layout.tsx`
- `apps/web/src/components/panel/PanelSidebarGuideFooter.tsx`
