# MERİDYEN MASTER UI/UX DESIGN SYSTEM & FRONTEND ARCHITECTURE STANDARD v2.0

> Bu doküman Meridyen ürün ailesinde geliştirilecek tüm arayüzler için
> bağlayıcı standarttır.

## 1. Ürün Tasarım Felsefesi

-   Insurance Operations Platform yaklaşımı
-   Sade, profesyonel, güven veren arayüz
-   Hız ve okunabilirlik önceliği

## 2. Tasarım İlkeleri

-   Fluent, Material, Apple HIG, Atlassian, HubSpot, Linear ve Dynamics
    referans alınacaktır.
-   Kopyalama yapılmayacak, ortak prensipler uygulanacaktır.

## 3. Design Token Sistemi

-   Sabit renk ve ölçü kullanılmayacaktır.
-   Renk, tipografi, spacing, radius, shadow ve motion token üzerinden
    yönetilecektir.

## 4. Tema Motoru

-   Light, Dark, Corporate Blue, Corporate Dark, High Contrast.
-   Theme Provider kullanılacaktır.
-   Kullanıcı tercihi kalıcı saklanacaktır.

## 5. Responsive Standardı

320--3840 px arası tüm çözünürlükler desteklenecektir.

## 6. Grid Sistemi

-   8 px grid zorunludur.

## 7. Tipografi

-   H1-H4, Body, Caption, Label, Button, Tooltip
    standartlaştırılacaktır.

## 8. Logo Sistemi

-   SVG zorunludur.
-   Header, Sidebar, Collapsed, Dark, White, Login, Splash, PDF, Mobile
    ve Favicon varyasyonları hazırlanacaktır.

## 9. Sidebar Sistemi

-   Açık/Kapalı, Auto Collapse, Favoriler, Son Kullanılanlar, Kullanım
    Kılavuzu, Yardım Merkezi.

## 10. Topbar

-   Logo, Global Arama, Bildirim, Yardım, Kullanım Kılavuzu, Tema, Dil,
    Profil, Sistem Durumu.

## 11. Dashboard

-   KPI, Grafik, Widget, Takvim, Aktivite Akışı, AI Paneli.

## 12. Component Library

-   Reusable Button, Card, Modal, Drawer, Table, DataGrid, Upload,
    DatePicker, Timeline vb.

## 13. Kullanım Kılavuzu

-   Sayfa bazlı yardım
-   Video
-   PDF
-   SSS
-   Aranabilir yardım merkezi

## 14. Motion & AI Ready

-   Hover, Focus, Modal, Notification animasyonları.
-   AI paneline hazır mimari.

## 15. Güvenlik

-   XSS koruması
-   HTML/Markdown/SVG sanitize
-   CSRF uyumu
-   JWT Refresh
-   Session & Idle Timeout
-   CSP
-   Clickjacking koruması
-   Güvenli dosya yükleme
-   Rol bazlı görünürlük
-   Source Map kapalı
-   Environment ayrımı
-   WCAG AA

## 16. Kod Kalitesi

-   TypeScript Strict
-   ESLint
-   Prettier
-   SOLID
-   Clean Code
-   Reusable Components
-   Lazy Loading
-   Tree Shaking

## 17. Cursor Kuralları

1.  Bu doküman bağlayıcı standarttır.
2.  Referans görsel yalnızca vizyon amaçlıdır.
3.  Mevcut mimari analiz edilmeden geliştirme yapılmayacaktır.
4.  Çalışan fonksiyonlar korunacaktır.
5.  Ortak bileşenler kullanılacaktır.
6.  Sabit renk ve ölçü kullanılmayacaktır.
7.  Tema sistemi zorunludur.
8.  Responsive destek zorunludur.
9.  Erişilebilirlik sağlanacaktır.
10. Performans korunacaktır.
11. Güvenlik kontrolleri tamamlanacaktır.
12. Kod tekrarından kaçınılacaktır.
13. Tasarım dili korunacaktır.
14. Test edilebilir geliştirme yapılacaktır.
15. Canlı öncesi doğrulama yapılacaktır.
16. Ölçeklenebilir mimari korunacaktır.
17. Nihai hedef kurumsal, sürdürülebilir bir tasarım sistemidir.
