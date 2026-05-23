const fs = require('fs');
const {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} = require('docx');

const out =
  '/Users/mustafayufkayurek/Desktop/TEST_NOTLARI_1_P1_CANLI_DEPLOY_SONUC_RAPORU_20260521.docx';

const cellBorder = { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' };
const borders = {
  top: cellBorder,
  bottom: cellBorder,
  left: cellBorder,
  right: cellBorder,
};

function paragraph(text, options = {}) {
  return new Paragraph({
    spacing: { after: 120 },
    ...options,
    children: [new TextRun(typeof text === 'string' ? text : String(text))],
  });
}

function bullet(text, level = 0) {
  return new Paragraph({
    text,
    bullet: { level },
    spacing: { after: 70 },
  });
}

function heading(text, level) {
  return new Paragraph({
    text,
    heading: level,
    spacing: { before: 240, after: 120 },
  });
}

function keyValueRow(label, value) {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 2800, type: WidthType.DXA },
        borders,
        shading: { fill: 'EEF4FF', type: ShadingType.CLEAR },
        children: [
          new Paragraph({
            children: [new TextRun({ text: label, bold: true })],
          }),
        ],
      }),
      new TableCell({
        width: { size: 8200, type: WidthType.DXA },
        borders,
        children: [new Paragraph(String(value))],
      }),
    ],
  });
}

function simpleTable(headers, rows, widths) {
  return new Table({
    width: { size: 11000, type: WidthType.DXA },
    rows: [
      new TableRow({
        children: headers.map((header, index) =>
          new TableCell({
            width: { size: widths[index], type: WidthType.DXA },
            borders,
            shading: { fill: 'EAF2F8', type: ShadingType.CLEAR },
            children: [
              new Paragraph({
                children: [new TextRun({ text: header, bold: true })],
              }),
            ],
          })
        ),
      }),
      ...rows.map((row) =>
        new TableRow({
          children: row.map((cell, index) =>
            new TableCell({
              width: { size: widths[index], type: WidthType.DXA },
              borders,
              children: [new Paragraph(String(cell))],
            })
          ),
        })
      ),
    ],
  });
}

const sections = [];

sections.push(
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
    children: [
      new TextRun({
        text: 'TEST NOTLARI-1 P1 CANLI DEPLOY SONUÇ RAPORU',
        bold: true,
        size: 30,
        color: '0F172A',
      }),
    ],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 300 },
    children: [
      new TextRun({
        text: '22 Mayıs 2026 · 08:25 +03 · Sunucu 94.138.216.18',
        size: 22,
        color: '475569',
      }),
    ],
  }),
  paragraph(
    'Bu rapor, P1 mini paket canlı deploy sonucunu; kapsamı, değişen dosyaları, image digest bilgilerini, build/health sonuçlarını, canlı test kanıtlarını ve nihai kararı profesyonel formatta özetlemek amacıyla hazırlanmıştır.'
  ),
  new Table({
    width: { size: 11000, type: WidthType.DXA },
    rows: [
      keyValueRow('Deploy Paketi', 'P1 mini paket: Test 1 (logo) + Test 4 (uyarı mesajı)'),
      keyValueRow('Dahil Değil', 'Test 5 bu deploy kapsamına alınmadı'),
      keyValueRow('Dokunulmayan Alan', 'P0 dosyalarına dokunulmadı'),
      keyValueRow('Genel Sonuç', 'P1 mini paket canlıda başarılı'),
    ],
  })
);

sections.push(heading('1. Deploy Kapsamı', HeadingLevel.HEADING_1));
sections.push(bullet('P1 mini paket yalnızca Test 1 (logo) ve Test 4 (uyarı mesajı) düzeltmelerini içerir.'));
sections.push(bullet('Test 5 kapsam dışı bırakılmıştır.'));
sections.push(bullet('P0 kapsamındaki Test 2 ve Test 3 dosyalarına dokunulmamıştır.'));

sections.push(heading('2. Değişen Dosyalar', HeadingLevel.HEADING_1));
sections.push(
  simpleTable(
    ['#', 'Dosya', 'Değişiklik Özeti'],
    [
      ['1', 'apps/backend/src/modules/system-settings/system-settings.controller.ts', 'GET company-info endpointi @Public() yapıldı'],
      ['2', 'apps/web/src/app/giris/page.tsx', 'Logo fetch, cache busting ve fallback eklendi'],
      ['3', 'apps/web/src/app/giris/sifre-sifirla/page.tsx', 'Logo fetch ve fallback eklendi'],
      ['4', 'apps/web/src/app/panel/layout.tsx', 'Logo fetch ve navbar render güncellendi'],
      ['5', 'apps/web/src/app/panel/ayarlar/kurulum/page.tsx', 'Sticky alert eklendi'],
      ['6', 'apps/web/src/app/panel/ayarlar/tanimlar/page.tsx', 'Sticky alert eklendi'],
      ['7', 'apps/web/src/app/panel/ayarlar/fiyat-yonetimi/page.tsx', 'Sticky alert eklendi'],
      ['8', 'apps/web/src/app/panel/ayarlar/sablonlar/page.tsx', 'Sticky alert eklendi'],
      ['9', 'apps/web/src/app/panel/kullanicilar/[id]/page.tsx', 'Sticky error mesajı eklendi'],
    ],
    [700, 6100, 4200]
  )
);

sections.push(heading('3. Önceki / Yeni Image Digest', HeadingLevel.HEADING_1));
sections.push(
  simpleTable(
    ['Bileşen', 'Önceki Digest', 'Yeni Digest'],
    [
      ['Backend', 'sha256:03f5f4b187614fbb1611481c64bf182237642d1bfa4e10887a67417d9b3fc317', 'sha256:b2e3364ddc480112920c64a813306e68bc4221d60128fc79989ed3b2317c9925'],
      ['Web', 'sha256:82fc60a992944e14966c8ddc9da96e721f8f2c37789ddfb49b4f69946304d2ff', 'sha256:d76da0df05ace56a9e6bb0c29b91483d0636ae25faed0491475835e6ce90fc31'],
    ],
    [1800, 4600, 4600]
  )
);
sections.push(bullet("Rollback ihtiyacında önceki digest'lere dönülebilir."));

sections.push(heading('4. Build Sonucu', HeadingLevel.HEADING_1));
sections.push(bullet('Backend tarafında --no-cache rebuild başarılı tamamlandı.'));
sections.push(bullet('Web tarafında --no-cache rebuild başarılı tamamlandı.'));
sections.push(bullet("Container'lar recreated ve started durumuna geldi."));

sections.push(heading('5. Backend / Web Health', HeadingLevel.HEADING_1));
sections.push(bullet('sigorta-backend: healthy ✅'));
sections.push(bullet('sigorta-web: healthy ✅'));

sections.push(heading('6. Test 1 — Logo Canlı Kanıtı', HeadingLevel.HEADING_1));
sections.push(bullet('GET /api/v1/system-settings/company-info çağrısı token olmadan 200 OK döndü ve logo data (base64) mevcut olarak doğrulandı.'));
sections.push(bullet('PUT /api/v1/system-settings/company-info çağrısı token olmadan BLOCKED kaldı; auth koruması devam ediyor.'));
sections.push(bullet("Logo; giriş, şifre sıfırlama ve panel navbar alanlarında company-info üzerinden fetch edilip render ediliyor."));
sections.push(bullet('Cache busting için ?v=Date.now() kullanıldı ve stale cache riski önlendi.'));
sections.push(bullet('Logo bulunmadığında shield ikonu ile Meridyen Assistance fallback görünümü korunuyor.'));
sections.push(
  new Paragraph({
    spacing: { before: 80, after: 160 },
    children: [new TextRun({ text: 'SONUÇ: PASS ✅', bold: true, color: '15803D', size: 24 })],
  })
);

sections.push(heading('7. Test 4 — Uyarı Mesajı Canlı Kanıtı', HeadingLevel.HEADING_1));
sections.push(bullet('Ayarlar > Kurulum, Tanımlar, Fiyat Yönetimi ve Şablonlar ekranlarında sticky top-0 z-40 shadow-sm deseni uygulandı.'));
sections.push(bullet('Kullanıcı Detay / Ekran İzinleri alanına sticky error mesajı eklendi.'));
sections.push(bullet('Mesajlar viewport üstüne sabitlendiği için kullanıcı ek yukarı kaydırma yapmak zorunda kalmıyor.'));
sections.push(bullet('Hata ikonu eklendi ve mesaj metin formatı okunabilir olacak şekilde iyileştirildi.'));
sections.push(
  new Paragraph({
    spacing: { before: 80, after: 160 },
    children: [new TextRun({ text: 'SONUÇ: PASS ✅', bold: true, color: '15803D', size: 24 })],
  })
);

sections.push(heading('8. Rollback', HeadingLevel.HEADING_1));
sections.push(bullet('Rollback uygulanmadı; deploy sırasında geri dönüş ihtiyacı doğmadı.'));

sections.push(heading('9. Nihai Karar', HeadingLevel.HEADING_1));
sections.push(bullet('Test 1: PASS ✅'));
sections.push(bullet('Test 4: PASS ✅'));
sections.push(bullet('P1 mini paket canlı ortamda başarılı bulundu.'));

sections.push(heading('10. Kalan Risk / Açık Maddeler', HeadingLevel.HEADING_1));
sections.push(bullet('Test 5 için karar bekleniyor; bu deploy kapsamında kod yazılmadı.'));
sections.push(bullet('offsite-backup placeholder maddesi izleniyor ve non-blocker olarak değerlendiriliyor.'));

sections.push(heading('11. Beyanlar', HeadingLevel.HEADING_1));
sections.push(bullet('P0 kapsamındaki Test 2 ve Test 3 dosyalarına dokunulmamıştır.'));
sections.push(bullet('Test 5 bu deploy paketine dahil edilmemiştir.'));
sections.push(bullet('Dashboard veya genel tasarım revizyonu yapılmamıştır.'));
sections.push(bullet('Kanıtsız PASS yazılmamış, tüm kararlar canlı API çağrıları ile doğrulanmıştır.'));

const doc = new Document({
  creator: 'Verdent',
  title: 'TEST NOTLARI-1 P1 CANLI DEPLOY SONUÇ RAPORU',
  description: 'P1 mini paket canlı deploy sonucu için profesyonel Word raporu',
  sections: [{ properties: {}, children: sections }],
});

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(out, buffer);
  console.log(`Rapor oluşturuldu: ${out}`);
});