const fs = require('fs');
const path = require('path');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  HeadingLevel,
  AlignmentType,
  PageBreak,
} = require('docx');

const output = '/Users/mustafayufkayurek/Desktop/TEST_NOTLARI_MODULU_UYGULAMA_SONUC_RAPORU_20260522.docx';
const imageDir = '/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/backend/uploads/report-images';
const images = fs.existsSync(imageDir)
  ? fs.readdirSync(imageDir).filter((name) => /\.(png|jpg|jpeg)$/i.test(name)).slice(0, 2)
  : [];

const border = { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' };
const tableBorders = { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border };

const paragraph = (text, opts = {}) => new Paragraph({
  spacing: { after: 120 },
  ...opts,
  children: [new TextRun({ text, bold: opts.bold, break: opts.break })],
});

const bullet = (text) => new Paragraph({
  text,
  bullet: { level: 0 },
  spacing: { after: 80 },
});

const makeTable = (rows) => new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  borders: tableBorders,
  rows: rows.map((cols, index) => new TableRow({
    children: cols.map((col) => new TableCell({
      width: { size: 50, type: WidthType.PERCENTAGE },
      children: [new Paragraph({
        children: [new TextRun({ text: String(col), bold: index === 0 })],
      })],
    })),
  })),
});

const sections = [
  new Paragraph({ text: 'TEST NOTLARI ve GEÇİCİ İŞ/GÖREV TAKİP MODÜLÜ', heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }),
  new Paragraph({ text: 'Uygulama Sonuç Raporu – 2026-05-22', alignment: AlignmentType.CENTER }),
  paragraph('Bu rapor sadece local doğrulama kapsamındaki uygulama sonucunu içerir. Production deploy yapılmamıştır.'),
  new Paragraph({ text: '1. Kapsam', heading: HeadingLevel.HEADING_1 }),
  bullet('Sadece Test Notları ve Geçici İş/Görev Takip modülü implement edildi.'),
  bullet('Admin-only geçici ekran eklendi; kalıcı modül devreye girdiğinde kaldırılabilir/arşivlenebilir.'),
  bullet('Production deploy yapılmadı; ayrıca açık onay beklenecek.'),
  new Paragraph({ text: '2. Değişen Dosyalar / Bileşenler', heading: HeadingLevel.HEADING_1 }),
  makeTable([
    ['Alan', 'Özet'],
    ['Prisma', 'WorkItem, TestNote, TestNoteFormat modelleri ve enumlar eklendi.'],
    ['Backend', 'Yeni test-notes modülü, CRUD endpointleri, danışman formatı üretimi, Excel export eklendi.'],
    ['Frontend', 'Admin-only geçici route, 4 sekmeli sayfa, formlar ve Excel indirme akışı eklendi.'],
    ['Yetki', 'test_notes_admin screen code backend/web tarafına eklendi ve menü linki açıldı.'],
  ]),
  new Paragraph({ text: '3. Migration', heading: HeadingLevel.HEADING_1 }),
  bullet('Migration klasörü: /Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/backend/prisma/migrations/20260523_test_notes_work_items'),
  bullet('Migration adı: 20260523_test_notes_work_items'),
  bullet('Local migrate denemesi veritabanı kapalı olduğu için localhost:5432 bağlantı hatası verdi.'),
  new Paragraph({ text: '4. Doğrulama Sonuçları', heading: HeadingLevel.HEADING_1 }),
  makeTable([
    ['Komut', 'Sonuç'],
    ['pnpm --filter @sigorta/backend typecheck', 'PASS'],
    ['pnpm --filter @sigorta/web typecheck', 'PASS'],
    ['pnpm --filter @sigorta/web build', 'PASS (mevcut Sentry/require-in-the-middle uyarıları ile)'],
    ['npx prisma migrate dev --name 20260523_test_notes_work_items', 'BLOCKED: localhost:5432 erişilemedi'],
  ]),
  new Paragraph({ text: '5. Ekran Kanıtları', heading: HeadingLevel.HEADING_1 }),
  paragraph('Yeni route build çıktısında doğrulandı: /panel/ayarlar/test-notlari-gorev-takip'),
  paragraph(images.length > 0 ? `Mevcut repo içi örnek görseller referans amaçlı rapora eklenecek ekran kanıtı placeholderı olarak notlandı: ${images.join(', ')}` : 'Bu ortamda canlı browser/screenshot aracı olmadığı için ekran kanıtı dosya olarak üretilemedi; build route çıktısı ve kaynak dosyalar doğrulama kanıtı olarak kullanıldı.'),
  new Paragraph({ text: '6. Rollback Planı', heading: HeadingLevel.HEADING_1 }),
  bullet('Yeni migration geri alınacak: ilgili tablolar ve enumlar drop edilecek ya da prisma migrate reset/dev ile test ortamı geri sarılacak.'),
  bullet('apps/backend/src/modules/test-notes ve apps/web/src/app/panel/ayarlar/test-notlari-gorev-takip altındaki dosyalar geri alınacak.'),
  bullet('screen permission ekleri ve layout menü linki revert edilecek.'),
  new Paragraph({ text: '7. Production Deploy Notu', heading: HeadingLevel.HEADING_1 }),
  paragraph('Production deploy yapılmadı. Deploy öncesi ayrıca açık yönetici onayı gereklidir.'),
  new Paragraph({ children: [new PageBreak()] }),
  new Paragraph({ text: '8. Teknik Karar Notları', heading: HeadingLevel.HEADING_1 }),
  bullet('Prisma client tipi migration uygulanamadığı için backend service içinde geçici typed accessor kullanıldı; DB erişimi sağlanınca migrate sonrası client regenerate ile doğal tiplere dönülebilir.'),
  bullet('Yetki kontrolü için mevcut permission mimarisi bozulmadan admin-only screen gating frontend üzerinde eklendi.'),
  bullet('Excel export tek workbook içinde 4 sheet olacak şekilde merkezi serviste kurgulandı.'),
];

const doc = new Document({
  numbering: {
    config: [{
      reference: 'bullets',
      levels: [{ level: 0, format: 'bullet', text: '•', alignment: AlignmentType.LEFT }],
    }],
  },
  sections: [{ children: sections }],
});

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(output, buffer);
  console.log(output);
});
