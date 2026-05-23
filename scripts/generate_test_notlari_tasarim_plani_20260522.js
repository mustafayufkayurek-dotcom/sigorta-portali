const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType, PageBreak, Header, Footer } = require('docx');

const outputPath = '/Users/mustafayufkayurek/Desktop/TEST_NOTLARI_MODULU_TASARIM_PLANI_20260522.docx';

const theme = {
  primary: '1F4E78',
  accent: 'D9EAF7',
  border: 'B7C9D6',
  muted: '5B6570',
  light: 'F7FAFC',
};

function text(value, options = {}) {
  return new TextRun({
    text: value,
    ...options,
  });
}

function p(children, options = {}) {
  const runs = Array.isArray(children) ? children : [text(children, options.textOptions || {})];
  return new Paragraph({
    children: runs,
    spacing: options.spacing || { after: 120 },
    alignment: options.alignment,
    heading: options.heading,
    bullet: options.bullet,
    indent: options.indent,
    thematicBreak: options.thematicBreak,
  });
}

function sectionTitle(value, level = HeadingLevel.HEADING_1) {
  return p([text(value, { bold: true, color: theme.primary, size: 28 })], {
    heading: level,
    spacing: { before: 240, after: 120 },
  });
}

function subTitle(value) {
  return p([text(value, { bold: true, color: '153A5B', size: 24 })], {
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 160, after: 100 },
  });
}

function bulletItem(value, level = 0) {
  return p(value, { bullet: { level }, spacing: { after: 60 } });
}

function makeTable(rows, widths) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map((row, rowIndex) => new TableRow({
      children: row.map((cell, cellIndex) => new TableCell({
        width: widths && widths[cellIndex] ? { size: widths[cellIndex], type: WidthType.PERCENTAGE } : undefined,
        shading: rowIndex === 0 ? { fill: theme.primary, type: ShadingType.CLEAR, color: 'auto' } : rowIndex % 2 === 0 ? { fill: theme.light, type: ShadingType.CLEAR, color: 'auto' } : undefined,
        borders: {
          top: { style: BorderStyle.SINGLE, color: theme.border, size: 4 },
          bottom: { style: BorderStyle.SINGLE, color: theme.border, size: 4 },
          left: { style: BorderStyle.SINGLE, color: theme.border, size: 4 },
          right: { style: BorderStyle.SINGLE, color: theme.border, size: 4 },
        },
        children: [new Paragraph({
          children: [
            new TextRun({
              text: cell,
              bold: rowIndex === 0,
              color: rowIndex === 0 ? 'FFFFFF' : '1F2937',
              size: 22,
            }),
          ],
          spacing: { before: 60, after: 60 },
        })],
      })),
    })),
  });
}

const content = [];

content.push(
  p([text('TEST NOTLARI VE GÖREV TAKİP MODÜLÜ', { bold: true, size: 36, color: theme.primary })], {
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 80 },
  }),
  p([text('Ürün + Teknik Tasarım Planı', { italics: true, size: 24, color: theme.muted })], {
    alignment: AlignmentType.CENTER,
    spacing: { after: 240 },
  }),
  makeTable([
    ['Belge Bilgisi', 'İçerik'],
    ['Tarih', '22.05.2026'],
    ['Teslim Tipi', 'Tek Word dosyası, kod/migration/deploy içermeyen tasarım ve uygulama planı'],
    ['İncelenen Sistem', 'Sigorta Hasar Sistemi - Next.js frontend, NestJS + Prisma backend'],
    ['Çıktı Amacı', 'Admin erişimine açık geçici test notu ve görev takip modülünün ürün, veri, yetki, entegrasyon ve devre dışı bırakma tasarımının hazırlanması'],
  ], [28, 72]),
  p('Bu rapor, mevcut proje yapısı incelenerek hazırlanmıştır. Uygulama yapılmamış; yalnızca gerçek dosya yolları, mevcut yetki/ekran mantığı ve Prisma/Nest modüler yapısı dikkate alınarak uygulanabilir tasarım önerisi oluşturulmuştur.', {
    spacing: { before: 140, after: 180 },
  }),
  sectionTitle('Yönetici Özeti')
);

[
  'Modül için en doğru yer, mevcut admin ağırlıklı yapı nedeniyle frontendde `/panel/ayarlar` menü kümesi altında yeni bir ekran ve backendde bağımsız bir Nest modülü olarak konumlandırmaktır.',
  'Yetki modeli mevcut `JwtAuthGuard` + `PermissionsGuard` zinciri ve frontend ekran görünürlüğü mantığıyla uyumlu ilerlemelidir; dış kullanıcı rollerine görünmez olmalıdır.',
  'Excel dışa aktarma için projede zaten bulunan `exceljs` bağımlılığı yeniden kullanılabilir; böylece yeni bir kütüphane ekleme ihtiyacı oluşmaz.',
  'Kalıcı görev-haberleşme modülü devreye girdiğinde önerilen geçiş stratejisi soft delete/arşivleme ve seçici veri taşıma yaklaşımıdır.',
].forEach((item) => content.push(bulletItem(item)));

content.push(sectionTitle('1. Admin Ekranında Açılacak Sayfanın Sekme Yapısı'));
content.push(
  p('Sayfa konumu ve navigasyon önerisi: ekran, mevcut yönetimsel yerleşime paralel biçimde `Ayarlar` açılır menüsü altında “Test Notları & Görev Takip” adıyla eklenmelidir. Bunun nedeni mevcut üst menüde admin odaklı sistem sayfalarının `apps/web/src/app/panel/layout.tsx` içinde `Ayarlar` kümesinde toplanmış olmasıdır.', {
    spacing: { after: 120 },
  }),
  makeTable([
    ['Öğe', 'Öneri'],
    ['Frontend route', '/panel/ayarlar/test-notlari-gorev-takip'],
    ['Menü konumu', 'Ayarlar dropdown içinde, kurulum/tanımlar/durumlar ile aynı yönetim grubunda'],
    ['Sayfa düzeni', 'Üstte başlık + açıklama + genel aksiyonlar, altında 4 sekmeli içerik alanı'],
    ['Sekmeler', 'İşler/Kararlar, Test Notları, Danışman Formatı, Excel/Rapor Çıktısı'],
  ], [30, 70]),
  subTitle('Sekme bazlı metin tabanlı wireframe'),
  bulletItem('Üst alan: sayfa başlığı, kısa kullanım açıklaması, son güncelleme bilgisi, filtre özetleri, global “Yeni Test Notu”, “Yeni İş/Karar”, “Excel İndir” aksiyonları.'),
  bulletItem('Sol/üst sekme şeridi: 4 sekme, aktif sekme vurgulu; mobilde yatay scroll veya dropdown fallback.'),
  bulletItem('Sağ tarafta bağlamsal panel: seçili kaydın kısa özeti, durum rozeti, sorumlu ve kanıt erişimi.'),
  bulletItem('Alt gövde: sekmeye göre liste + detay form kombinasyonu veya split layout.'),
  subTitle('Sekme wireframe açıklaması'),
  makeTable([
    ['Sekme', 'Wireframe açıklaması'],
    ['İşler/Kararlar', 'Solda sıra numaralı tablo/list, sağda seçili işin detay kartı. Üstte filtreler: durum, öncelik, sorumlu, hedef tarih. Satır seçildiğinde sağ panelde konu, kullanıcı yorumu, kapanış notu, kanıtlar ve tarih bilgileri görünür.'],
    ['Test Notları', 'Üstte hızlı giriş butonu, solda kart/list görünümü, sağda oluşturma/düzenleme formu. Form dili teknik olmayan kullanıcıyı destekleyen yardım metinleriyle ilerler.'],
    ['Danışman Formatı', 'Solda seçilen test notları listesi, ortada 7 adımlı dönüşüm ön izlemesi, sağda onay kutuları ve “Mühendislik görevine dönüştür” butonu. Kullanıcı onayı olmadan kayıt üretmez.'],
    ['Excel/Rapor Çıktısı', 'Filtre paneli + çıktı seçenekleri + kolon şablonu özeti. Alt tarafta son indirilen rapor geçmişi veya oluşturulacak rapor ön izlemesi yer alır.'],
  ], [18, 82]),
  p('Layout önerisi: masaüstünde 12 kolonlu grid ile 8/4 veya 7/5 split; tablette sekme içeriği tek kolon; mobilde önce filtreler, sonra liste, ardından form sıralaması. Bu yaklaşım mevcut panel ekranlarının geniş içerik kullanım şekline uyumludur.', {
    spacing: { after: 120 },
  })
);

content.push(sectionTitle('2. Test Notları Sekmesinin Alanları'));
content.push(
  makeTable([
    ['Alan', 'Tip', 'Zorunlu', 'Kural / Açıklama'],
    ['Test No', 'String', 'Sistem üretir', 'Format: TN-2026-XXXX. Yıl + sıralı sayı. Kullanıcı değiştiremez.'],
    ['Ekran/Modül', 'Select', 'Evet', 'Dashboard, kullanıcılar, dosya oluşturma, finans, raporlar, ayarlar, operasyon vb. kontrollü liste.'],
    ['Kullanıcı Gözlemi', 'Textarea', 'Evet', 'Teknik bilgi gerektirmez; sade dil. Minimum 15 karakter önerilir.'],
    ['Beklenen Davranış', 'Textarea', 'Evet', 'Sistemden beklenen sonuç kullanıcı diliyle yazılır.'],
    ['Ekran Görüntüsü/Kanıt', 'Dosya yükleme', 'Hayır ama önerilir', 'Birden fazla dosya veya tekil kanıt; resim, pdf, docx, bağlantı.'],
    ['Öncelik', 'Select', 'Evet', 'P0, P1, P2, Karar Gerekli. Varsayılan P2 olabilir.'],
    ['Durum', 'Select', 'Evet', 'Yeni, İncelemede, Düzeltme Bekliyor, Canlıda, Kabul, Backlog. Varsayılan Yeni.'],
    ['Tekrar durumu', 'Checkbox/flag', 'Hayır', 'Aynı sorunun yeniden oluştuğunu işaretler.'],
  ], [18, 12, 10, 60]),
  subTitle('Form layout önerisi'),
  bulletItem('1. satır: Test No (readonly), Ekran/Modül, Öncelik, Durum'),
  bulletItem('2. satır: Tekrar durumu checkbox + ilgili tarih/son tekrar bilgisi'),
  bulletItem('3. satır: Kullanıcı Gözlemi textarea'),
  bulletItem('4. satır: Beklenen Davranış textarea'),
  bulletItem('5. satır: Kanıt yükleme alanı + link ekleme alternatifi'),
  subTitle('Validasyon kuralları'),
  bulletItem('Kullanıcı Gözlemi ve Beklenen Davranış boş bırakılamaz.'),
  bulletItem('Kullanıcı Gözlemi alanında salt teknik jargon zorunlu olmamalı; sistem eğitim metni göstermeli.'),
  bulletItem('Kanıt dosyasında uzantı ve boyut limiti uygulanmalı; mevcut upload altyapısına uyumlu şekilde yapılandırılmalı.'),
  bulletItem('Durum “Canlıda” veya “Kabul” seçiliyorsa en az bir değerlendirme notu veya kapanış açıklaması önerilmelidir.'),
  bulletItem('Tekrar durumu işaretlendiğinde önceki kayıt referansı veya tekrar tarihi opsiyonel olarak alınabilir.'),
  p('Kullanıcı deneyimi notu: form, teknik olmayan kullanıcıların serbest metinle kayıt açmasını teşvik etmeli; zorunlu alan sayısı minimum tutulmalı, sistem geri kalan yapısallaştırmayı Danışman Formatı sekmesinde tamamlamalıdır.', {
    spacing: { after: 120 },
  })
);

content.push(sectionTitle('3. İşler/Kararlar Sekmesinin Alanları'));
content.push(
  makeTable([
    ['Alan', 'Tip', 'Kural'],
    ['Sıra No', 'Otomatik integer', 'Oluştuğunda atanır, değişmez. Sıralama alanı değil kimliksel iş numarasıdır.'],
    ['Konu', 'Kısa metin', 'İşin veya kararın başlığı.'],
    ['Kaynak', 'Select', 'Test notu, kullanıcı talebi, teknik, operasyon, yönetim kararı vb.'],
    ['Öncelik', 'Select', 'P0, P1, P2, Karar Gerekli veya görev seviyesi ölçeğiyle eşlenebilir.'],
    ['Sorumlu', 'User relation', 'Tek ana sorumlu; gerektiğinde destekleyen ekip ikincil alanda tutulabilir.'],
    ['Hedef Tarih', 'DateTime', 'Hatırlatma mantığıyla birlikte kullanılır.'],
    ['Durum', 'Select', 'Yeni, planlandı, yapılıyor, beklemede, tamamlandı, iptal edildi gibi normalize liste.'],
    ['Kullanıcı yorumu', 'Textarea', 'Kararı isteyen tarafın iş dili açıklaması.'],
    ['Kanıt', 'Dosya/link', 'Ekran görüntüsü, doküman, issue linki, dış bağlantı.'],
    ['Kapanış notu', 'Textarea', 'Tamamlanma veya iptal gerekçesi.'],
  ], [18, 18, 64]),
  subTitle('Görsel durum kuralı'),
  bulletItem('Tamamlanan işler listede gri ton, üstü çizili başlık ve pasif aksiyonlarla gösterilmelidir.'),
  bulletItem('Tamamlanan iş satırı arşivlenmeden önce okunabilir kalmalı; sadece düzenleme aksiyonları kısıtlanmalıdır.'),
  bulletItem('Sıra no filtreleme veya manuel sürükleme ile değişmemelidir; yalnızca görüntü sırası farklı kriterlerle yeniden düzenlenebilir.'),
  subTitle('Hatırlatma kurgusu'),
  bulletItem('Hedef tarih yaklaşırken uyarı rozeti'),
  bulletItem('Vadesi geçen işlerde kırmızı durum etiketi'),
  bulletItem('İsteğe bağlı e-posta/bildirim entegrasyonu, fakat ilk fazda sadece veri alanı ve UI göstergesi yeterlidir'),
  p('Bu sekme test notu odaklı kayıtları operasyona çevirdiği için, `TestNote -> WorkItem` ilişkisi bire-çok desteklemelidir. Tek test notundan birden fazla iş veya karar maddesi üretilebilir.', {
    spacing: { after: 120 },
  })
);

content.push(sectionTitle('4. Danışman Formatı Üretim Mantığı'));
content.push(
  p('Danışman Formatı sekmesi, kullanıcı tarafından sade dille girilmiş notları mühendislik ekibinin uygulayabileceği yarı standart formata dönüştürür. Buradaki amaç, teknik dili kullanıcıdan beklemeden kaliteyi artırmaktır.', {
    spacing: { after: 120 },
  }),
  makeTable([
    ['Adım', 'Dönüşüm çıktısı', 'Detay'],
    ['1', 'Sorunun sade özeti', 'Kullanıcı gözlemi tek cümlelik net problem ifadesine indirgenir.'],
    ['2', 'Beklenen davranış', 'İstenen sonuç, eylem odaklı net bir ifade ile yazılır.'],
    ['3', 'Etki sınıfı', 'Müşteri güveni, operasyon, finans, yetki, performans kategorilerinden biri veya birkaçı seçilir.'],
    ['4', 'Öncelik', 'P0/P1/P2/Karar Gerekli değerlerinden biri belirlenir.'],
    ['5', 'Mühendislik talimatı', 'Etkilenen ekran, API, olası veri modeli, dosya ve iş akışı belirtilir.'],
    ['6', 'Kabul kriteri', 'Ne olduğunda iş tamam kabul edilir sorusu cevaplanır.'],
    ['7', 'Kanıt beklentisi', 'Ekran görüntüsü, Excel çıktısı, yetki testi, akış videosu vb. teslim tanımlanır.'],
  ], [10, 24, 66]),
  subTitle('Buton ve onay akışı'),
  bulletItem('“Danışman formatına dönüştür” tek tuş aksiyonu seçili Test Note kaydı üzerinde çalışır.'),
  bulletItem('Dönüşüm sonucu önce ön izleme olarak gösterilir; kullanıcı onayı olmadan WorkItem veya teknik görev oluşmaz.'),
  bulletItem('Onay sonrası ister sadece format kaydı oluşur, ister ayrıca İşler/Kararlar sekmesine yeni iş taslağı düşer.'),
  subTitle('Örnek dönüştürme mantığı'),
  bulletItem('Girdi: “Finans ekranında tahsilat sonrası toplam hemen değişmiyor.”'),
  bulletItem('Çıktı özeti: “Tahsilat kaydı sonrasında finans özet kartları sayfa yenilenmeden güncellenmelidir.”'),
  bulletItem('Etki sınıfı: Operasyon + finans'),
  bulletItem('Kabul kriteri: Tahsilat kaydı sonrası liste ve özet kartı 2 saniye içinde yeni değeri göstermeli.'),
  p('Bu sekme için ayrı tablo tutulması mantıklıdır; çünkü kullanıcı notu, mühendislik formatı ve onay durumu birbirinden farklı yaşam döngüsüne sahiptir.', {
    spacing: { after: 120 },
  })
);

content.push(sectionTitle('5. Excel Export Kapsamı'));
content.push(
  p('Excel dışa aktarma için mevcut projede halihazırda kullanılan `exceljs` tercih edilmelidir. Kanıt: backend bağımlılıklarında `exceljs` mevcuttur ve `apps/backend/src/modules/dashboard/export.service.ts` içinde aktif kullanım vardır. Bu nedenle yeni kütüphane eklemek yerine aynı stil korunmalıdır.', {
    spacing: { after: 120 },
  }),
  makeTable([
    ['Kapsam', 'İçerik'],
    ['Filtreli test notları indir', 'Durum, öncelik, modül, tekrar durumu, tarih aralığına göre indirilebilir liste'],
    ['Filtreli işler indir', 'Durum, sorumlu, hedef tarih, kaynak, öncelik bazlı liste'],
    ['Seçili notlardan toplu rapor', 'Birden çok test notu seçilip tek Excel içinde ayrı sayfa veya tek sheet olarak alınır'],
    ['Durum özetleri', 'Her durum için adet, açık/kapalı oranı, tekrar eden kayıt sayısı'],
    ['Kanıt referansları', 'Dosya adı, link veya storage anahtarı kolonları'],
  ], [28, 72]),
  subTitle('Şablon/kolon yapısı'),
  makeTable([
    ['Sheet', 'Önerilen kolonlar'],
    ['Test Notları', 'Test No, Modül, Gözlem, Beklenen Davranış, Öncelik, Durum, Tekrar, Oluşturan, Oluşturma Tarihi, Son Güncelleme, Kanıt Sayısı'],
    ['İşler', 'Sıra No, Konu, Kaynak, Öncelik, Sorumlu, Hedef Tarih, Durum, Kullanıcı Yorumu, Kapanış Notu, Kanıt Var/Yok'],
    ['Özet', 'Toplam test notu, açık test notu, backlog, canlıya alınan, toplam iş, tamamlanan iş, vadesi geçen iş'],
    ['Danışman Formatı', 'Bağlı Test No, Özet, Etki Sınıfı, Öncelik, Mühendislik Talimatı, Kabul Kriteri, Kanıt Beklentisi, Onay Durumu'],
  ], [18, 82]),
  bulletItem('İlk satır başlıkları renkli ve kilitli olmalı.'),
  bulletItem('Uzun metin alanları wrap text ile gösterilmeli.'),
  bulletItem('Durum ve öncelik kolonlarına renk kodlaması uygulanmalı.'),
  bulletItem('İndirilen dosya adı tarih + filtre özeti içermeli.'),
  p('Frontend tarafında sadece indirme tetiklenebilir; asıl şablon üretimi backend üzerinde tutulmalıdır. Böylece yetki, veri birleştirme ve dosya erişimi tek noktadan kontrol edilir.', {
    spacing: { after: 120 },
  })
);

content.push(sectionTitle('6. Yetki Kuralı'));
content.push(
  makeTable([
    ['Kural', 'Tasarım kararı'],
    ['Görünürlük', 'Sadece admin / sistem yöneticisi rolleri görebilir'],
    ['Dış roller', 'Müşteri, tedarikçi, eksper, sigortalı kullanıcı ve portal kullanıcılarında tamamen görünmez'],
    ['Backend koruması', 'JWT + permission guard + yeni özel permission kodu'],
    ['Frontend koruması', 'Menüde role-based gösterim + ekran izinleri listesine yeni screen code eklenmesi'],
  ], [24, 76]),
  subTitle('Mevcut sistemle uyum'),
  bulletItem('Backendde global `JwtAuthGuard` ve `PermissionsGuard` zaten aktif; yeni endpointler de aynı zincire dahil edilmelidir.'),
  bulletItem('`apps/backend/src/common/guards/permissions.guard.ts` içinde admin rolü tam yetkili kabul ediliyor; bu modül için özel izin kodu tanımlansa dahi admin doğal erişim kazanır.'),
  bulletItem('Frontendde `apps/web/src/app/panel/layout.tsx` içindeki `ROUTE_ACCESS`, `NAV_ITEM_ACCESS` ve `SCREEN_TO_PATH` eşlemelerine yeni route eklenmesi gerekir.'),
  bulletItem('Ayrıca `apps/backend/src/modules/users/screen-permissions.defaults.ts` ve `apps/web/src/utils/screen-permissions.ts` içine yeni screen code eklenmelidir.'),
  subTitle('Önerilen permission / screen tasarımı'),
  bulletItem('Permission kodu: `system.test_notes_manage` veya mevcut naming standardına daha yakın şekilde `system.manage` kapsaması altında alt modül erişimi'),
  bulletItem('Screen code: `test_notlari_gorev_takip`'),
  bulletItem('Sadece `admin` default ekran listesine eklenmeli; diğer rollerde varsayılan görünür olmamalı'),
  p('Bu yaklaşım, menü görünmezliğini sadece UI seviyesinde bırakmaz; doğrudan API erişim denemelerini de backendden reddeder.', {
    spacing: { after: 120 },
  })
);

content.push(sectionTitle('7. Geçici Sayfanın Kaldırılma/Arşivleme Kuralı'));
content.push(
  p('Modül geçici haberleşme/görev koordinasyon yüzeyi olarak tasarlandığı için kalıcı görev-haberleşme modülü devreye girdiğinde kontrollü devre dışı bırakma kuralı gerekir.', {
    spacing: { after: 120 },
  }),
  makeTable([
    ['Senaryo', 'Önerilen aksiyon'],
    ['Kalıcı modül devreye alındı, veri korunacak', 'Sayfa sadece arşiv görünümüne alınır; yeni kayıt kapatılır'],
    ['Kalıcı modül veri taşıması tamamlandı', 'Menüden kaldırılır, backend endpointleri read-only arşiv erişimine döner'],
    ['Tam kapanış', 'Arşiv süresi sonunda soft-deleted kayıtlar kalıcı modüle veya arşiv depoya taşınır'],
  ], [34, 66]),
  subTitle('Arşivleme stratejisi'),
  bulletItem('`isArchived` flag alanı önerilir; ayrıca `archivedAt`, `archivedByUserId`, `archiveReason` alanları faydalıdır.'),
  bulletItem('Soft delete yaklaşımı tercih edilmelidir; çünkü karar geçmişi ve test kanıtları sonradan denetim için gerekebilir.'),
  bulletItem('UI seviyesinde “Arşiv” filtresi ayrı olmalı; varsayılan listede aktif kayıtlar görünmelidir.'),
  subTitle('Veri migrasyonu yaklaşımı'),
  bulletItem('Kalıcı görev modülü geldiğinde eşleme tablosu veya geçiş scripti ile WorkItem kayıtları hedef modüle taşınır.'),
  bulletItem('TestNote ve TestNoteFormat kayıtları ya hedef modülün açıklama/geçmiş tablolarına dönüştürülür ya da referans arşivde bırakılır.'),
  bulletItem('Kanıt dosyaları taşınmıyorsa mevcut storage anahtarları korunmalı, sadece referans entity id güncellenmelidir.'),
  p('Buradaki veri migrasyonu ifadesi bu raporda yalnızca tasarım seviyesindedir; gerçek geçiş için ileride ayrı migration ve data backfill planı hazırlanmalıdır.', {
    spacing: { after: 120 },
  })
);

content.push(sectionTitle('8. DB Tablo Önerisi ve Migration Etkisi'));
content.push(
  p('Prisma şeması incelendiğinde proje çok sayıda iş alanını modüler tablolarda yönetiyor. Bu modül için üç yeni tablo önerisi yeterlidir: `TestNote`, `WorkItem`, `TestNoteFormat`. Ayrıca dosya kanıtları için mevcut belge altyapısıyla entegrasyon tercih edilmelidir.', {
    spacing: { after: 120 },
  }),
  subTitle('Önerilen veri modeli'),
  makeTable([
    ['Tablo', 'Ana alanlar', 'İlişki / not'],
    ['TestNote', 'id, testNo, moduleCode, userObservation, expectedBehavior, priority, status, isRepeat, createdByUserId, assignedToUserId?, archived flags, timestamps', 'Birden fazla WorkItem ve sıfır/bir veya çok TestNoteFormat kaydıyla ilişkili olabilir'],
    ['WorkItem', 'id, sequenceNo, subject, sourceType, priority, status, ownerUserId, dueAt, reminderAt, userComment, closureNote, sourceTestNoteId?, archived flags, timestamps', 'İsteğe bağlı olarak TestNote kaynağına bağlanır'],
    ['TestNoteFormat', 'id, testNoteId, plainSummary, expectedBehaviorText, impactClass, prioritySuggestion, engineeringInstruction, acceptanceCriteria, evidenceExpectation, approvedByUserId?, approvedAt?', 'Her test notu için versiyonlanabilir veya son sürüm mantığında tutulabilir'],
  ], [16, 46, 38]),
  subTitle('Alan tipi ve indeks önerileri'),
  bulletItem('`testNo` unique index'),
  bulletItem('`sequenceNo` unique index, immutable business key'),
  bulletItem('`status`, `priority`, `moduleCode`, `ownerUserId`, `dueAt`, `isArchived` alanlarında sorgu indeksleri'),
  bulletItem('`sourceTestNoteId` ve `testNoteId` alanlarında foreign key'),
  bulletItem('Zaman damgaları: `createdAt`, `updatedAt`; arşiv için `archivedAt`'),
  subTitle('Mevcut tablolara etki'),
  bulletItem('`User` tablosuna doğrudan yeni kolon gerekmez; sadece yeni relation alanları eklenir.'),
  bulletItem('Kanıt yönetiminde mevcut `EntityDocument` veya yükleme altyapısı kullanılacaksa entity type genişletmesi gerekir.'),
  bulletItem('Alternatif olarak ilk fazda doğrudan file metadata bu tablolarda tutulabilir; ancak proje genel desenine göre belge sistemiyle entegre olmak daha temizdir.'),
  subTitle('Migration sırası önerisi'),
  makeTable([
    ['Sıra', 'Önerilen migration adı', 'İçerik'],
    ['1', '20260522_add_test_notes_work_items_tables', 'Yeni tablolar, enum veya check alanları, indexler'],
    ['2', '20260522_link_test_note_documents_permissions', 'Belge/permission/screen code genişletmeleri gerekiyorsa ikinci adım'],
    ['3', '20260522_seed_test_notes_permissions', 'Permission ve role eşlemeleri için seed veya veri backfill'],
  ], [10, 36, 54]),
  p('Kalıcı görev modülüne uyumluluk açısından `WorkItem` tablosu, ileride ortak task domainine taşınabilecek şekilde genel isimlendirme ile tutulmalıdır; sadece test notuna özel olmamalıdır.', {
    spacing: { after: 120 },
  })
);

content.push(sectionTitle('9. Mevcut Koda Dokunulacak Dosyalar'));
content.push(
  p('Aşağıdaki referanslar mevcut proje taraması sonucu çıkarılmıştır. Satır numaraları yaklaşık aralık olarak verilmiştir; uygulama anında dosya güncel durumuna göre doğrulanmalıdır.', {
    spacing: { after: 120 },
  }),
  makeTable([
    ['Katman', 'Dosya', 'Beklenen değişiklik'],
    ['Frontend layout', 'apps/web/src/app/panel/layout.tsx', 'Yeni route erişim kuralı, nav görünürlüğü, `SCREEN_TO_PATH` eşlemesi ve Ayarlar dropdown linki'],
    ['Frontend route', 'apps/web/src/app/panel/ayarlar/test-notlari-gorev-takip/page.tsx', 'Yeni sayfa container ve sekme yapısı'],
    ['Frontend yardımcı tipler', 'apps/web/src/utils/screen-permissions.ts', 'Yeni screen code ve label eklenmesi'],
    ['Backend app registration', 'apps/backend/src/app.module.ts', 'Yeni modül import ve registration'],
    ['Backend module', 'apps/backend/src/modules/test-notes-work-items/test-notes-work-items.module.ts', 'Controller + service + provider tanımı'],
    ['Backend controller', 'apps/backend/src/modules/test-notes-work-items/test-notes-work-items.controller.ts', 'CRUD, danışman formatı ve export endpointleri'],
    ['Backend service', 'apps/backend/src/modules/test-notes-work-items/test-notes-work-items.service.ts', 'İş kuralları, sıra/test no üretimi, filtreleme, export hazırlığı'],
    ['Backend guard usage', 'apps/backend/src/common/guards/permissions.guard.ts', 'Gerekirse yeni permission fallback eşlemesi'],
    ['Backend user screens', 'apps/backend/src/modules/users/screen-permissions.defaults.ts', 'Admin default screen listesine yeni ekran kodu'],
    ['Prisma schema', 'apps/backend/prisma/schema.prisma', 'Yeni model/relation/index tanımları'],
  ], [18, 37, 45]),
  subTitle('Satır civarı referans notları'),
  bulletItem('`apps/web/src/app/panel/layout.tsx`: route erişim blokları dosyanın üst kısmında, navbar linkleri orta bölümde yer alıyor; yaklaşık 20-110 arası erişim tanımları, 260-360 arası üst menü linkleri.'),
  bulletItem('`apps/backend/src/app.module.ts`: modül importları dosyanın ilk yarısında, `imports` dizisi orta bölümde.'),
  bulletItem('`apps/backend/src/modules/users/users.controller.ts`: ekran izinleri endpointleri dosyanın orta-son bölümünde.'),
  subTitle('Yan etki analizi'),
  bulletItem('Layout tarafında yanlış role/screen code eklenirse admin dışı kullanıcılar menüyü görebilir; bu nedenle hem route hem nav hem screen mapping birlikte güncellenmelidir.'),
  bulletItem('Prisma relation eklenirken `User` modeline yeni relation alanları ekleneceği için generate sonrası tip etkisi oluşacaktır.'),
  bulletItem('Export endpointi büyük veri çekerse performans etkisi olabilir; filtreleme zorunlu veya pagination sonrası export modeli düşünülmelidir.'),
  bulletItem('Kanıt yükleme mevcut upload modülüne bağlanırsa dosya görünürlüğü kuralları tekrar gözden geçirilmelidir.'),
  p('Yeni backend modülü için klasör adı olarak `test-notes-work-items` önerilmiştir; mevcut modüler isimlendirme (`service-types`, `report-templates`, `vendor-statements`) ile uyumludur.', {
    spacing: { after: 120 },
  })
);

content.push(sectionTitle('10. Kabul Kriterleri ve Canlı Test Kanıtları'));
content.push(
  makeTable([
    ['Kriter', 'Test senaryosu', 'Beklenen kanıt'],
    ['K1', 'Admin kullanıcı panelde ilgili menüye gider ve Test Notları sekmesini açar', 'Ekran görüntüsü: sekmeler görünür, sayfa başlığı doğru'],
    ['K2', 'Teknik olmayan kullanıcı gibi sade bir gözlem girilir', 'Canlı akış videosu veya ardışık ekran görüntüsü: form teknik jargon olmadan tamamlanır'],
    ['K3', 'Filtreli Excel indirme tetiklenir', 'İndirilen `.xlsx` dosyası ve kolonların dolu olduğuna dair dosya kanıtı'],
    ['K4', 'Bir test notu danışman formatına dönüştürülür', 'Örnek çıktı ekran görüntüsü veya export edilmiş doküman bölümü'],
    ['K5', 'İşler listesinde sıra numarası ve durum görünür', 'Liste ekran görüntüsü, farklı durum rozetleriyle'],
    ['K6', 'Tamamlanan iş ayırt edilir ve silinme/arşivleme kuralı belgelenmiştir', 'UI ekran görüntüsü + dokümanda arşiv kuralı referansı'],
    ['K7', 'Yetkisiz kullanıcı aynı route veya APIye erişmeye çalışır', '403/redirect kanıtı, menü görünmezliği ekranı veya test çıktısı'],
  ], [10, 50, 40]),
  subTitle('Kabul testi detayları'),
  bulletItem('K1 için test verisi: admin rolü ile giriş, menü görünürlük ve sekme render kontrolü.'),
  bulletItem('K2 için test dili: “Finans ekranında toplamlar geç geliyor” benzeri sade kayıt açılışı.'),
  bulletItem('K3 için kontrol: dosya adı, sheet isimleri, özet veriler, tarih damgası.'),
  bulletItem('K4 için kontrol: 7 alanın tamamı dolu, kullanıcı onayı olmadan teknik işe dönüşmemiş.'),
  bulletItem('K5 için kontrol: sıra numarası manuel düzenleme ile değişmiyor, durum filtresi çalışıyor.'),
  bulletItem('K6 için kontrol: tamamlanan satır gri/üstü çizili, arşivleme açıklaması yardım veya dokümanda mevcut.'),
  bulletItem('K7 için kontrol: müşteri/tedarikçi/eksper rollerinde hem menü gizli hem endpoint erişimi reddediliyor.'),
  p('Canlı test kanıtları tesliminde ekran görüntüsü, indirilen Excel örneği ve yetki denemesi sonuçları minimum paket olarak önerilir. Eğer danışman formatı çıktısı ayrıca Word/PDF alınacaksa, bu modülün ikinci fazı için ek kabul maddesi tanımlanabilir.', {
    spacing: { after: 120 },
  })
);

content.push(sectionTitle('Teknik Karar Özeti'));
content.push(
  bulletItem('Yeni ekranın `Ayarlar` altında konumlandırılması, mevcut admin merkezli navigasyonla en uyumlu çözümdür.'),
  bulletItem('Backendde bağımsız modül yaklaşımı, sonradan kalıcı görev modülüne geçişte ayrıştırmayı kolaylaştırır.'),
  bulletItem('Excel üretiminde `exceljs` yeniden kullanılmalıdır.'),
  bulletItem('Yetki için hem permission hem screen-code hem menü görünürlüğü birlikte ele alınmalıdır.'),
  bulletItem('Geçici modül olduğundan arşiv/soft delete tasarımı ilk günden düşünülmelidir.'),
  p('Bu plan, uygulama ekibinin UI, API, DB ve yetki iş paketlerine ayrılabileceği düzeyde somutlaştırılmıştır. Kod yazılmadan önce bu belge üzerinden backlog kırılımı, tahmini efor ve sprint planı üretilebilir.', {
    spacing: { after: 160 },
  })
);

const doc = new Document({
  creator: 'Verdent',
  title: 'Test Notları Modülü Tasarım Planı',
  description: 'Sigorta Hasar Sistemi için ürün ve teknik tasarım planı',
  sections: [{
    headers: {
      default: new Header({
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: 'Test Notları ve Görev Takip Modülü Tasarım Planı', color: theme.muted, size: 18 })],
          }),
        ],
      }),
    },
    footers: {
      default: new Footer({
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: 'Hazırlanma tarihi: 22.05.2026', color: theme.muted, size: 18 })],
          }),
        ],
      }),
    },
    properties: {},
    children: content,
  }],
});

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(outputPath, buffer);
  process.stdout.write(outputPath);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});