const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableCell, TableRow, WidthType, BorderStyle } = require('docx');
const fs = require('fs');

const out = '/Users/mustafayufkayurek/Desktop/TEST_NOTLARI_1_P1_MINI_PAKET_SONUC_RAPORU_20260521.docx';

function h1(text) {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_1, spacing: { after: 200 } });
}
function h2(text) {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } });
}
function h3(text) {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_3, spacing: { before: 200, after: 100 } });
}
function p(text, opts = {}) {
  return new Paragraph({ children: [new TextRun({ text, ...opts })], spacing: { after: 120 } });
}
function bullet(text) {
  return new Paragraph({ text, bullet: { level: 0 }, spacing: { after: 80 } });
}
function code(text) {
  return new Paragraph({ children: [new TextRun({ text, font: 'Courier New', size: 20, color: '1f2937' })], spacing: { after: 120 } });
}

const sections = [];

sections.push(
  new Paragraph({
    children: [new TextRun({ text: 'TEST NOTLARI-1 P1 MINI PAKET', bold: true, size: 32, color: '0b1f3a' })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 100 },
  }),
  new Paragraph({
    children: [new TextRun({ text: 'Sonuç Raporu — 21 Mayıs 2026', size: 24, color: '64748b' })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
  }),
  p('Bu rapor Test 1 (Logo Yansıma) ve Test 4 (Uyarı Mesajı Görünürlük) düzeltmelerini, kök neden analizini, değişen dosyaları, yerel doğrulama sonuçlarını ve kalan riskleri içerir.'),
  p('Sınır: Yalnızca Test 1 ve Test 4 kapsanmıştır. Test 5 bu pakete dahil değildir.')
);

sections.push(h1('TEST 1 — Logo Yansıma'));
sections.push(h2('Önceki Durum'));
sections.push(p('Kurulum sihirbazında yüklenen logo (Genel Bilgiler > Şirket Logosu) anasayfa (/giris) ve panel navbar üzerinde görünmüyordu. Kullanıcı logo yükledikten sonra giriş ekranında hâlâ sabit "Meridyen Assistance" metni ve shield ikonu görüyordu.'));
sections.push(h2('Kök Neden'));
sections.push(bullet('Giriş sayfası (giris/page.tsx) ve şifre sıfırlama (giris/sifre-sifirla/page.tsx) company-info API\'sini çağırmıyordu.'));
sections.push(bullet('Panel layout (panel/layout.tsx) navbar\'ında logo alanı statik SVG + metin olarak hardcoded idi.'));
sections.push(bullet('Backend GET /system-settings/company-info endpoint\'i @RequirePermissions(\'settings.view\') koruması altındaydı; giriş öncesi (token olmadan) erişilemiyordu.'));
sections.push(bullet('Logo URL\'sinde cache busting parametresi yoktu; tarayıcı eski logoyu cache\'den sunabiliyordu.'));

sections.push(h2('Değişen Dosyalar'));
sections.push(code('apps/web/src/app/giris/page.tsx'));
sections.push(bullet('companyLogo ve companyName state eklendi.'));
sections.push(bullet('useEffect içinde axios.get(`${API_URL}/system-settings/company-info`) çağrısı eklendi.'));
sections.push(bullet('Logo yüklendiyse <img src={companyLogo}> render ediliyor; yoksa default shield + metin fallback gösteriliyor.'));
sections.push(bullet('Cache busting: URL\'ye ?v=${Date.now()} eklendi (varsa korundu).'));
sections.push(bullet('onError handler ile broken image durumunda fallback aktif.'));

sections.push(code('apps/web/src/app/giris/sifre-sifirla/page.tsx'));
sections.push(bullet('Aynı logo fetch + cache busting + fallback deseni uygulandı.'));

sections.push(code('apps/web/src/app/panel/layout.tsx'));
sections.push(bullet('Navbar\'a companyLogo ve companyName prop\'ları eklendi.'));
sections.push(bullet('Layout seviyesinde axios.get(`${API_BASE}/system-settings/company-info`) ile logo çekiliyor.'));
sections.push(bullet('Navbar logo alanı: companyLogo varsa <img>, yoksa default shield + metin.'));

sections.push(code('apps/backend/src/modules/system-settings/system-settings.controller.ts'));
sections.push(bullet('@Get(\'company-info\') üzerine @Public() decorator eklendi; auth gerektirmeden erişilebilir hale getirildi.'));
sections.push(bullet('@Put(\'company-info\') hâlâ @RequirePermissions(\'settings.manage\') ile korunuyor.'));

sections.push(h2('Yerel Doğrulama'));
sections.push(bullet('Web typecheck: 0 hata (tsc --noEmit).'));
sections.push(bullet('Web build: Başarılı (next build), tüm sayfalar prerendered/dynamic olarak üretildi.'));
sections.push(bullet('Backend typecheck: 0 hata (tsc --noEmit).'));

sections.push(h2('Test Adımları ve Kanıt'));
sections.push(bullet('Adım 1: /giris sayfası açıldı. Network tab\'de GET /system-settings/company-info 200 döndü.'));
sections.push(bullet('Adım 2: Kurulum sihirbazında logo yüklendi (logoUrl base64/data URL olarak kaydedildi).'));
sections.push(bullet('Adım 3: /giris yenilendi; yeni logo navbar\'da göründü (cache busting ?v= timestamp ile).'));
sections.push(bullet('Adım 4: Farklı tarayıcıda /giris açıldı; logo korundu (veri DB\'de, client\'ta localStorage cache yok).'));
sections.push(bullet('Adım 5: Panel layout\'ta logo navbar\'da göründü; yüklenmemişse default marka metni korundu.'));

sections.push(h2('Sonuç'));
sections.push(p('PASS', { bold: true, color: '16a34a', size: 24 }));
sections.push(p('Logo anasayfa, giriş ve panel navbar\'ında görünür. Cache busting çalışıyor. Default fallback güvenli. Production deploy önerilir.'));

sections.push(h1('TEST 4 — Uyarı Mesajı Görünürlük'));
sections.push(h2('Önceki Durum'));
sections.push(p('Hata/başarı mesajları (ErrorAlert / SuccessAlert) sayfa içeriğinin başında inline olarak render ediliyordu. Sayfa uzun olduğunda mesaj viewport dışında kalıyor, kullanıcı fark etmiyordu. Mobil/desktop tutarsızlık vardı.'));

sections.push(h2('Kök Neden'));
sections.push(bullet('ErrorAlert ve SuccessAlert bileşenleri sadece "mb-4" ile yukarıdan boşluk bırakıyordu; sticky konumlandırma yoktu.'));
sections.push(bullet('Kullanıcı sayfa aşağı kaydırdığında alert içerikle birlikte yukarı çıkıyordu.'));
sections.push(bullet('İkon tutarsızlığı vardı (ErrorAlert\'ta hata ikonu yoktu).'));

sections.push(h2('Değişen Dosyalar'));
sections.push(code('apps/web/src/app/panel/ayarlar/kurulum/page.tsx'));
sections.push(bullet('ErrorAlert: sticky top-0 z-40 + shadow-sm + hata ikonu eklendi.'));
sections.push(bullet('SuccessAlert: sticky top-0 z-40 + shadow-sm + metin <span> içine alındı.'));

sections.push(code('apps/web/src/app/panel/ayarlar/tanimlar/page.tsx'));
sections.push(bullet('ErrorAlert ve SuccessAlert aynı sticky/desen ile güncellendi.'));

sections.push(code('apps/web/src/app/panel/ayarlar/fiyat-yonetimi/page.tsx'));
sections.push(bullet('ErrorAlert ve SuccessAlert aynı sticky/desen ile güncellendi.'));

sections.push(code('apps/web/src/app/panel/ayarlar/sablonlar/page.tsx'));
sections.push(bullet('ErrorAlert sticky top-0 z-40 + shadow-sm + ikon eklendi.'));

sections.push(code('apps/web/src/app/panel/kullanicilar/[id]/page.tsx'));
sections.push(bullet('Ekran izinleri sekmesindeki inline hata mesajı sticky top-0 z-40 + ikon + shadow-sm ile güncellendi.'));

sections.push(h2('Yerel Doğrulama'));
sections.push(bullet('Web typecheck: 0 hata.'));
sections.push(bullet('Web build: Başarılı.'));

sections.push(h2('Test Adımları ve Kanıt'));
sections.push(bullet('Adım 1: Kurulum Sihirbazı > Mail Kurulum sekmesine geçildi; SMTP sunucu boş bırakılıp Kaydet tıklandı.'));
sections.push(bullet('Adım 2: Hata mesajı viewport\'un en üstünde sticky olarak göründü; sayfa aşağı kaydırılsa bile mesaj sabit kaldı (z-40).'));
sections.push(bullet('Adım 3: Başarı mesajı (örn. "Şirket bilgileri kaydedildi.") aynı şekilde sticky üstte göründü.'));
sections.push(bullet('Adım 4: Mobil görünümde (devTools 375px) mesajlar yine viewport içinde, kaydırma gerektirmeden göründü.'));
sections.push(bullet('Adım 5: Kullanıcılar > Kullanıcı Detay > Ekran İzinleri sekmesinde hata mesajı sticky olarak göründü.'));

sections.push(h2('Sonuç'));
sections.push(p('PASS', { bold: true, color: '16a34a', size: 24 }));
sections.push(p('Ayarlar, Kurulum Sihirbazı ve Kullanıcılar ekranlarında mesajlar viewport içinde, sticky olarak görünür. Kullanıcı sayfa kaydırmak zorunda kalmıyor. Modern, sade, tutarlı feedback deseni uygulandı.'));

sections.push(h1('Kalan Risk ve Öneriler'));
sections.push(bullet('Test 5 bu pakete dahil değil; karar bekliyor.'));
sections.push(bullet('Logo base64/data URL olarak DB\'de saklanıyor; çok büyük logolar (5MB+) performansı etkileyebilir. İleride CDN / file upload servisi önerilir.'));
sections.push(bullet('Alert mesajları otomatik kapanmıyor; kullanıcı kapatana kadar kalıyor. İsteğe bağlı olarak 5sn sonra otomatik kapanma eklenebilir.'));
sections.push(bullet('Production deploy sonrası canlı ekran görüntüsü ve API testi önerilir.'));

sections.push(h1('Deploy Protokolü Özeti'));
sections.push(bullet('Image digest kaydet → SCP → --no-cache rebuild → health check.'));
sections.push(bullet('Rollback noktası: Mevcut image digest (deploy önceki son stabil image).'));
sections.push(bullet('Canlı kanıt: /giris ve /panel ekran görüntüleri + GET /system-settings/company-info 200 kontrolü.'));

const doc = new Document({
  sections: [{
    properties: {},
    children: sections,
  }],
});

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(out, buffer);
  console.log('Rapor oluşturuldu:', out);
});
