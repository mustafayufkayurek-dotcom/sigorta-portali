const docx = require('/tmp/docx-gen/node_modules/docx');
const fs = require('fs');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
} = docx;

const outputPath = '/Users/mustafayufkayurek/Desktop/SPRINT1_KAPANIS_RAPORU.docx';

const makeBullet = (text) =>
  new Paragraph({
    text,
    bullet: { level: 0 },
    spacing: { after: 120 },
  });

const makeSection = (title, bullets) => [
  new Paragraph({
    text: title,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
  }),
  ...bullets.map((item) => makeBullet(item)),
];

const children = [
  new Paragraph({
    children: [
      new TextRun({
        text: 'Verdent — Sprint 1 Kapanış ve Doğrulama Raporu',
        bold: true,
      }),
    ],
    heading: HeadingLevel.HEADING_1,
    spacing: { after: 200 },
  }),
  new Paragraph({
    text: 'Tarih: 6 Mayıs 2026',
    spacing: { after: 300 },
  }),
  ...makeSection('1. Before / After Ekran Karşılaştırmaları', [
    'Before: Login sonrası direkt Kanban board (/panel/acil-yardim), KPI yok, genel bakış yok, hangi dosya kaçta bilinmiyor',
    'After: Yeni /panel dashboard — KPI kartları (açık dosya, bugün atanan, SLA yaklaşan, aylık tahsilat), animasyonlu count-up, trend göstergeleri, durum dağılım grafiği, son aktiviteler timeline, hızlı aksiyonlar',
  ]),
  ...makeSection('2. Loading Davranış Değişimi', [
    "Before: Sayfa geçişlerinde beyaz ekran, veri yüklenirken boş alan, kullanıcı 'bozuldu mu?' hissi",
    "After: Her route'ta skeleton loading (8 sayfa), TopProgressBar ile geçiş animasyonu, KPI kartlarında skeleton → animasyonlu veri geçişi",
  ]),
  ...makeSection('3. Kullanıcı Akış Hissi Değerlendirmesi', [
    'Before: İşlem sonrası geri bildirim yok, silme onaysız, hata mesajları generic İngilizce',
    'After: LoadingButton (spinner + disable), ConfirmModal (silme onayı, backdrop blur), Toast notification (success/error/info Türkçe), en az 3 formda entegre',
  ]),
  ...makeSection('4. Premium UX Etkisi Değerlendirmesi', [
    "Dashboard'da kurumsal hissiyat: card hiyerarşisi, renk kodlu trend göstergeleri, subtle shadow/hover",
    'Dark mode tam uyum',
    "Skeleton'lar sayfa yapısına özel (tablo, kart, form, liste)",
    'Animasyonlar hafif ve performans dostu (requestAnimationFrame count-up, CSS transition)',
  ]),
  ...makeSection('5. Mobil Görünüm Değerlendirmesi', [
    'Dashboard KPI grid: 4 → 2 → 1 kolon (responsive)',
    'Skeleton bileşenleri responsive',
    "TopProgressBar mobile'da da çalışıyor",
    "ConfirmModal full-width padding ile mobile uyumlu",
  ]),
  ...makeSection('6. Regression Kontrol Sonuçları', [
    'TypeScript build: 0 hata',
    'Mevcut Kanban board (/panel/acil-yardim) korundu',
    'Login akışı çalışıyor (smoke test: 200 + token)',
    'Sidebar navigasyonu bozulmadı',
    "Tüm mevcut route'lar erişilebilir",
  ]),
  ...makeSection('7. Worker/Task Execution Problemleri ve Lessons Learned', [
    "Problem: 3 ardışık task 'tamamlandı' deyip hiçbir dosya oluşturmadı",
    "Kök neden: Worker'lar proje yapısını keşfetmekle vakit harcayıp timeout'a düştü; dosya oluşturma adımına hiç geçemedi",
    "Çözüm: Dosya içeriklerini tam olarak (copy-paste ready) task prompt'una yazarak verildi; 1 dosya hariç geri kalanı manager tarafından direkt yazıldı",
    'Lesson: Kritik dosya oluşturma tasklarında tam içerik verilmeli veya manager direkt müdahale etmeli',
  ]),
  new Paragraph({
    text: 'Sonuç',
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
  }),
  makeBullet('Sprint 1 başarıyla tamamlanmıştır. Danışman başarı kriterlerinin tamamı karşılanmıştır:'),
  makeBullet('Loading belirsizliği azaltıldı'),
  makeBullet('İşlem geri bildirimleri eklendi'),
  makeBullet('KPI okunabilirliği sağlandı'),
  makeBullet('Kurumsal/güven veren dashboard oluşturuldu'),
  makeBullet('Performans algısı iyileştirildi'),
  makeBullet('Regression 0 bug'),
  makeBullet("Sprint 2'ye geçiş için hazır."),
];

const doc = new Document({
  sections: [
    {
      children,
    },
  ],
});

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(outputPath, buffer);
  console.log(`Rapor oluşturuldu: ${outputPath}`);
});