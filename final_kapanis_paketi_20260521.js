const fs = require('fs');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  ShadingType,
  PageBreak,
} = require('docx');

const out = '/Users/mustafayufkayurek/Desktop/test-oncesi-final-kapanis-paketi-20260521.docx';
const generatedAt = '2026-05-21';
const cellBorder = { style: BorderStyle.SINGLE, size: 1, color: 'BFBFBF' };
const borders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

function p(text, options = {}) {
  return new Paragraph({
    spacing: { after: 120 },
    ...options,
    children: [new TextRun(String(text))],
  });
}

function bullet(text, level = 0) {
  return new Paragraph({
    text,
    bullet: { level },
    spacing: { after: 80 },
  });
}

function cell(text, width, header = false, align = AlignmentType.LEFT) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders,
    shading: header ? { fill: 'EAF2F8', type: ShadingType.CLEAR } : undefined,
    children: [
      new Paragraph({
        alignment: align,
        children: [new TextRun({ text: String(text), bold: header })],
      }),
    ],
  });
}

function row(values, widths, header = false, aligns = []) {
  return new TableRow({
    children: values.map((value, index) =>
      cell(value, widths[index], header, aligns[index] || AlignmentType.LEFT),
    ),
  });
}

const sections = [];

sections.push(
  new Paragraph({
    heading: HeadingLevel.TITLE,
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'Test Öncesi Final Kapanış Paketi', bold: true, size: 34 })],
    spacing: { after: 180 },
  }),
);
sections.push(
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 240 },
    children: [new TextRun({ text: 'N-22 Final Kapanış Raporu — 21.05.2026', size: 24 })],
  }),
);
sections.push(p('Teslim kapsamı: tek Word dosya. Yeni kod, deploy, migration, seed, env/secret değişikliği yapılmamıştır.'));
sections.push(p('Kritik not: Bu görevde yeni Telegram test mesajı gönderilmemiş, Kapı 1/2/3/4 yeniden açılmamış, P0-5 ihbar CRUD Faz 2/backlog kararı korunmuş, dosya numarası ve sigorta şirketi manuel kullanım kararı değiştirilmemiştir.'));

sections.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('1. Yönetici Özeti')] }));
sections.push(bullet('Kapı 1 production kabulü korunmuştur; önceki kanıtta 8/8 smoke PASS ve deploy kabulü mevcuttur, bu pakette yeni deploy yapılmamıştır.'));
sections.push(bullet('Kapı 2 için P0/P1 kapanış kararı korunmuştur; P0-5 operasyonel ihbar CRUD için Faz 2/backlog bağlayıcı kararı aynen korunmuştur.'));
sections.push(bullet('Kapı 3 için 25 not envanteri ve “yeni blocker yok” kararı korunmuş, N-22 kapanış paketine bağlanmıştır.'));
sections.push(bullet('Kapı 4 için Telegram hedefli kurulum PASS ve tek test mesajı SENT geçmiş kanıtı referans alınmıştır; bu görevde yeni mesaj gönderilmemiştir.'));
sections.push(bullet('N-22 kısa canlı smoke 21.05.2026 00:58 +03 kanıtlarıyla production üzerinde PASS olarak tamamlanmıştır. 7/7 smoke maddesi geçti ve teste geçiş kararı GEÇİLEBİLİR olarak güncellenmiştir.'));

sections.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('2. Kapı 1 Özeti')] }));
sections.push(bullet('Production deploy kabulü daha önce tamamlanmıştır.'));
sections.push(bullet('Önceki Kapı 1 kapanış kanıtında health yöntemi yalnız docker inspect ile verilmiş, 8/8 smoke PASS raporlanmıştır.'));
sections.push(bullet('Bu final pakette Kapı 1 yeniden açılmamış, yeni deploy veya rollback uygulanmamıştır.'));
sections.push(bullet('Artık işlem yapılmayacağı ve teste geçiş için Kapı 1’in kapalı kabul edildiği not edilmiştir.'));

sections.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('3. Kapı 2 Özeti')] }));
sections.push(bullet('P0-2 kullanıcı oluşturma validasyon + create: PASS olarak kapanmıştır.'));
sections.push(bullet('P0-3 yeni hasar dosyası submit akışı: PASS olarak kapanmıştır.'));
sections.push(bullet('P1-1 evrak türleri endpoint/API çelişkisi: PASS olarak kapanmıştır.'));
sections.push(bullet('P1-3 form submit feedback: PASS olarak kapanmıştır.'));
sections.push(bullet('P0-5 ihbar oluşturma/düzenleme akışı gerçek operasyonel ihbar CRUD modülü olarak kapsam dışı görülmüş ve Faz 2/backlog kararı bağlayıcı şekilde korunmuştur.'));

sections.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('4. Kapı 3 Özeti')] }));
sections.push(bullet('Kapı 3 raporunda 25 kullanıcı notu envanteri oluşturulmuş ve sınıflandırılmıştır.'));
sections.push(bullet('Yeni blocker olmadığı, kapatılmış P0/P1 maddelerin tekrar açılmayacağı ve test öncesi yalnız bağlayıcı kararların korunacağı raporlanmıştır.'));
sections.push(bullet('Dosya numarası manuel kullanım, sigorta şirketi manuel kullanım ve P0-5 Faz 2/backlog kararları korunmuştur.'));
sections.push(bullet('N-22 final kapanış paketi, Kapı 3’teki bu kararların teslim dosyasına bağlandığı son katmandır.'));

sections.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('5. Kapı 4 Özeti')] }));
sections.push(bullet('Önceki Kapı 4 raporunda Telegram hedefli kurulum PASS olarak kapanmıştır.'));
sections.push(bullet('Secret değerler maskeli tutulmuş, açık secret yazılmamıştır.'));
sections.push(bullet('Tek test mesajı SENT geçmiş kanıtı referans alınmıştır.'));
sections.push(bullet('Bu görevde yeni Telegram test mesajı gönderilmemiştir; yalnız önceki kapanış kanıtı devralınmıştır.'));

sections.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('6. Canlı Sistem Durumu')] }));
sections.push(
  new Table({
    width: { size: 10800, type: WidthType.DXA },
    rows: [
      row(['Kalem', 'Durum', 'Kanıt/Not'], [2400, 1800, 6600], true),
      row(['Backend container health', 'HEALTHY', '21.05.2026 00:58 +03 canlı smoke kanıtında backend healthy olarak doğrulandı.'], [2400, 1800, 6600]),
      row(['Web container health', 'HEALTHY', '21.05.2026 00:58 +03 canlı smoke kanıtında web healthy olarak doğrulandı.'], [2400, 1800, 6600]),
      row(['Backend image digest', 'Kayıtlı', 'sha256:b586dc2aeb40 (21.05.2026 canlı smoke özeti).'], [2400, 1800, 6600]),
      row(['Web image digest', 'Önceki teyit ile kayıtlı', 'Web image digest bu smoke özetinde ayrıca verilmedi; 20.05.2026 canlı teyit raporunda sha256:e674451bca6ca8dd99630d22f047d76176621c2372c09532402328014f97a5af kayıtlı.'], [2400, 1800, 6600]),
      row(['Tarih/Saat', 'Doğrulandı', 'Production zaman kanıtı: 2026-05-21 00:58:08 +03.'], [2400, 1800, 6600]),
    ],
  }),
);

sections.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('7. N-22 Kısa Canlı Smoke')] }));
sections.push(p('Talimat gereği smoke production üzerinde yeniden çalıştırılmış ve 21.05.2026 00:58 +03 kanıtlarıyla başarıyla tamamlanmıştır. Health kontrolü backend/web için healthy gelmiş, API smoke maddeleri ve Telegram/script kontrolleri PASS olarak doğrulanmıştır.'));

sections.push(
  new Table({
    width: { size: 10800, type: WidthType.DXA },
    rows: [
      row(['Madde', 'Beklenen', 'Sonuç', 'Kanıt'], [900, 2600, 1200, 6100], true),
      row(['1', 'POST /api/v1/auth/login → 201, data.tokens.accessToken', 'PASS', '201 döndü ve access token alındı.'], [900, 2600, 1200, 6100]),
      row(['2', 'GET /api/v1/auth/me → 200', 'PASS', '200 döndü; admin@meridyenassistance.com kullanıcı bilgisi doğrulandı.'], [900, 2600, 1200, 6100]),
      row(['3', 'GET /api/v1/users', 'PASS', '200 döndü; 18 kullanıcı listelendi.'], [900, 2600, 1200, 6100]),
      row(['4', 'GET /api/v1/insurance-companies → 200', 'PASS', '200 döndü; 10 şirket listelendi.'], [900, 2600, 1200, 6100]),
      row(['5', 'GET /api/v1/document-types → 200', 'PASS', '200 döndü; 13 tür listelendi.'], [900, 2600, 1200, 6100]),
      row(['6', 'GET /api/v1/claim-subjects → 200', 'PASS', '200 döndü; 24 konu listelendi.'], [900, 2600, 1200, 6100]),
      row(['7', 'Telegram log tail + script/cron varlığı', 'PASS', 'Telegram log içinde son 3 satır SENT. Test mesajı dahil. 13 script mevcut, 7 cron satırı aktif.'], [900, 2600, 1200, 6100]),
      row(['Health', 'docker inspect → backend/web healthy', 'PASS', 'Backend healthy, web healthy. Zaman damgası: 2026-05-21 00:58:08 +03.'], [900, 2600, 1200, 6100]),
    ],
  }),
);

sections.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('7.1 Canlı Smoke Kanıt Özeti')] }));
sections.push(bullet('Canlı smoke zamanı: 21 Mayıs 2026, 00:58 +03.'));
sections.push(bullet('Sistem durumu: backend healthy, web healthy.'));
sections.push(bullet('Image kanıtı: sha256:b586dc2aeb40.'));
sections.push(bullet('Smoke özeti: 7/7 PASS.'));

sections.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('8. Operasyonel Riskler')] }));
sections.push(bullet('Offsite-backup hâlâ placeholder script yaklaşımıyla kayıtlıdır; bu alan operasyonel risk olarak korunur.'));
sections.push(bullet('Telegram tarafında geçmiş Kapı 4 kapanışı, N-22 canlı smoke içinde log ve script varlığıyla yeniden desteklenmiştir.'));
sections.push(bullet('Offsite-backup placeholder notu operasyonel risk olarak korunur; ancak blocker değildir.'));
sections.push(bullet('P0-5 operasyonel ihbar CRUD ürün kapsamı hâlâ Faz 2/backlog’tur; test öncesi blocker değildir ancak beklenti yönetimi doğru yapılmalıdır.'));
sections.push(bullet('Dosya numarası ve sigorta şirketi alanlarının manuel kullanım kararı operasyonel olarak korunmaktadır; otomasyon beklentisi bu pakette yoktur.'));

sections.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('9. Teste Geçiş Kararı')] }));
sections.push(
  p(
    'Karar: GEÇİLEBİLİR. Gerekçe: Kapı 1/2/3/4 geçmiş kapanış kararları korunmuş, N-22 kısa canlı smoke 21.05.2026 00:58 +03 kanıtlarıyla 7/7 PASS tamamlanmış ve production health + temel API + Telegram/script kontrolleri olumlu sonuç vermiştir.',
  ),
);
sections.push(
  p(
    'Yönetimsel yorum: Bu dosya hem önceki kabul kanıtlarını tek pakette toplar hem de 21.05.2026 production N-22 smoke tekrarının olumlu sonucunu resmi kapanış kararına bağlar. Bu aşamada teste geçiş için ek teknik blocker görünmemektedir.',
  ),
);

sections.push(new Paragraph({ children: [new PageBreak()] }));
sections.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('10. Kaynak Kanıtlar')] }));
sections.push(bullet('/Users/mustafayufkayurek/Desktop/canliya-alinan-alinmayan-isler-teyit-raporu-20260520.md'));
sections.push(bullet('/Users/mustafayufkayurek/Desktop/kapi2-kalan-p0-p1-final-kapanis-raporu-20260520.docx'));
sections.push(bullet('/Users/mustafayufkayurek/Desktop/kapi3-kullanici-notlari-envanter-ve-aksiyon-raporu-20260520.docx'));
sections.push(bullet('/Users/mustafayufkayurek/Desktop/p0-5-ihbar-crud-urun-karar-notu-20260520.docx'));
sections.push(bullet('/Users/mustafayufkayurek/Desktop/kapi4-telegram-hedefli-kurulum-sonuc-raporu-20260521.docx'));
sections.push(bullet('21.05.2026 00:58 +03 N-22 canlı smoke özeti: backend healthy, web healthy, auth/login 201, auth/me 200, users 200 (18), insurance-companies 200 (10), document-types 200 (13), claim-subjects 200 (24), Telegram SENT logları mevcut, 13 script ve 7 cron satırı aktif.'));

const doc = new Document({
  creator: 'Verdent',
  title: 'Test Öncesi Final Kapanış Paketi',
  description: 'N-22 final kapanış raporu',
  sections: [{ properties: {}, children: sections }],
});

Packer.toBuffer(doc).then((buffer) => fs.writeFileSync(out, buffer));