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
  ShadingType,
  HeadingLevel,
  AlignmentType,
  PageBreak,
} = require('docx');

const outputPath = '/Users/mustafayufkayurek/Desktop/faz1-patch-detay-karar-raporu-20260518.docx';

const border = { style: BorderStyle.SINGLE, size: 1, color: 'CFCFCF' };
const borders = { top: border, bottom: border, left: border, right: border };

function p(text, options = {}) {
  return new Paragraph({
    spacing: { after: options.after ?? 120, before: options.before ?? 0, line: 276 },
    alignment: options.alignment,
    heading: options.heading,
    children: [
      new TextRun({
        text,
        bold: options.bold ?? false,
        size: options.size ?? 22,
      }),
    ],
  });
}

function bullet(text) {
  return new Paragraph({
    spacing: { after: 60, line: 276 },
    bullet: { level: 0 },
    children: [new TextRun({ text, size: 21 })],
  });
}

function makeCell(text, width, fill, bold = false) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders,
    shading: fill ? { fill, type: ShadingType.CLEAR } : undefined,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children: [
      new Paragraph({
        spacing: { after: 40, line: 240 },
        children: [new TextRun({ text: String(text), bold, size: 20 })],
      }),
    ],
  });
}

function makeTable(headers, rows, widths) {
  return new Table({
    width: { size: 9300, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map((header, index) => makeCell(header, widths[index], 'D9EAF7', true)),
      }),
      ...rows.map((row) =>
        new TableRow({
          children: row.map((value, index) => makeCell(value, widths[index])),
        }),
      ),
    ],
  });
}

const fazRows = [
  ['/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/backend/src/modules/users/users.controller.ts', '7-7', 'Importa DTO tipleri eklendi', 'Orta', 'Faz içi + faz dışı karışık', 'Evet; Create/Update DTO importları nested relation alanlarını da taşıyor'],
  ['/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/backend/src/modules/users/users.controller.ts', '35-35', 'POST /users body tipi CreateUserDto oldu', 'Orta', 'Faz dışı', 'Evet; DTO içinde departmentMemberships/responsibilityAssignments var'],
  ['/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/backend/src/modules/users/users.controller.ts', '45-45', 'PATCH /users/:id body tipi UpdateUserDto oldu', 'Orta', 'Faz dışı', 'Evet; nested DTO etkisi taşınıyor'],
  ['/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/backend/src/modules/users/users.controller.ts', '71-71', 'PUT /users/:id body tipi UpdateUserDto oldu', 'Orta', 'Faz dışı', 'Evet; nested DTO etkisi taşınıyor'],
  ['/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/backend/src/modules/users/users.controller.ts', '136-145', 'screen-permissions endpointinde legacy screenPermissions ve canonical screens payloadı normalize ediliyor', 'Düşük', 'Faz içi', 'Hayır'],
  ['/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/backend/src/modules/users/users.controller.ts', '149-157', 'insurance-company-scopes admin endpointi ekleniyor', 'Düşük', 'Faz içi', 'Hayır'],
  ['/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/backend/src/modules/users/users.service.ts', '7-7', 'Prisma importu helper include/transaction client için eklendi', 'Orta', 'Faz dışı', 'Evet; userDetailInclude ve nested helper bloklarına bağlı'],
  ['/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/backend/src/modules/users/users.service.ts', '56-56', 'findOne include yapısı helper metoduna taşındı', 'Orta', 'Faz dışı', 'Evet; helper faz dışı ilişkileri de include ediyor'],
  ['/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/backend/src/modules/users/users.service.ts', '78-105', 'create akışı transaction + nested relation persist mantığına alındı', 'Yüksek', 'Faz dışı', 'Evet; departmentMemberships ve responsibilityAssignments'],
  ['/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/backend/src/modules/users/users.service.ts', '121-158', 'update akışı transaction + role switch cleanup ile genişletildi', 'Yüksek', 'Faz dışı', 'Evet; role switch cleanup, nested relation persist'],
  ['/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/backend/src/modules/users/users.service.ts', '172-188', 'ROLE_SWITCH_CLEANUP audit log eklendi', 'Orta', 'Faz dışı', 'Evet; role switch cleanup'],
  ['/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/backend/src/modules/users/users.service.ts', '234-236', 'service-areas input boşsa mevcut alanları döndür guard eklendi', 'Düşük', 'Faz dışı', 'Hayır; Faz 1 kapsamı dışında'],
  ['/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/backend/src/modules/users/users.service.ts', '251-392', 'userDetailInclude ve nested relation helper metodları eklendi', 'Yüksek', 'Faz dışı', 'Evet; departmentMemberships, responsibilityAssignments, isPrimary, role switch cleanup'],
  ['/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/backend/src/modules/users/users.service.ts', '433-435', 'screen-permissions için null/array guard eklendi', 'Düşük', 'Faz içi', 'Hayır'],
  ['/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/backend/src/modules/users/users.service.ts', '450-478', 'insurance-company-scopes güncelleme servisi eklendi', 'Düşük', 'Faz içi', 'Hayır'],
  ['/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/backend/src/modules/users/users.dto.ts', '5-28', 'Department membership ve responsibility assignment input DTO’ları eklendi', 'Orta', 'Faz dışı', 'Evet; operasyon yapısı fazı'],
  ['/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/backend/src/modules/users/users.dto.ts', '86-100', 'CreateUserDto içine nested relation alanları eklendi', 'Orta', 'Faz dışı', 'Evet; departmentMemberships/responsibilityAssignments'],
  ['/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/backend/src/modules/users/users.dto.ts', '110-161', 'screen-permissions normalize DTO’ları ve insurance-company-scopes DTO’su eklendi', 'Düşük', 'Faz içi', 'Hayır'],
  ['/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/web/src/app/panel/kullanicilar/page.tsx', '3-12', 'Yeni helper/component importları eklendi', 'Yüksek', 'Çoğunlukla faz dışı', 'Evet; UserScopeSections, UserImpactSummary, scope mapper/rules'],
  ['/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/web/src/app/panel/kullanicilar/page.tsx', '32-46', 'User ve form state tipi operasyon alanlarıyla genişletildi', 'Yüksek', 'Faz dışı', 'Evet; departmentMemberships/responsibilityAssignments/scope'],
  ['/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/web/src/app/panel/kullanicilar/page.tsx', '79-102', 'DEFAULT_FORM ve operasyon sabitleri eklendi', 'Orta', 'Faz dışı', 'Evet; operasyon UI altyapısı'],
  ['/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/web/src/app/panel/kullanicilar/page.tsx', '124-150', 'Modal tabs/footer destekleyecek şekilde refactor edildi', 'Orta', 'Faz dışı', 'Hayır; UI refactor'],
  ['/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/web/src/app/panel/kullanicilar/page.tsx', '194-307', 'Yeni state ve lookup yüklemeleri eklendi', 'Orta', 'Faz dışı', 'Evet; departments, provinces, insuranceCompanies'],
  ['/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/web/src/app/panel/kullanicilar/page.tsx', '363-429', 'Edit modali detay user + screen permissions + insurance scopes okuyacak hale geldi', 'Orta', 'Karışık', 'Evet; insurance scope Faz 1, scope hydrate faz dışı'],
  ['/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/web/src/app/panel/kullanicilar/page.tsx', '432-550', 'Scope update/toggle helperları eklendi', 'Yüksek', 'Faz dışı', 'Evet; operasyon yapısı'],
  ['/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/web/src/app/panel/kullanicilar/page.tsx', '568-646', 'Create/update akışları buildUserPayload, service-areas, screen-permissions ve insurance-company-scopes çağrılarına bölündü', 'Yüksek', 'Karışık', 'Evet; Faz 1 çağrıları faz dışı scope payload ile karışık'],
  ['/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/web/src/app/panel/kullanicilar/page.tsx', '987-1244', 'Yeni sekmeli modal, operasyon yapısı alanları, rol ayarları ve etki özeti eklendi', 'Yüksek', 'Faz dışı', 'Evet; UI refactor + operasyon yapısı + Türkçeleştirme'],
  ['/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/web/src/app/panel/ayarlar/kurulum/page.tsx', '3-12', 'Kullanıcı yönetimi yardımcı importları kurulum sayfasına taşındı', 'Yüksek', 'Çoğunlukla faz dışı', 'Evet'],
  ['/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/web/src/app/panel/ayarlar/kurulum/page.tsx', '78-134', 'User tipi ve form state operasyon alanlarıyla genişletildi', 'Yüksek', 'Faz dışı', 'Evet'],
  ['/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/web/src/app/panel/ayarlar/kurulum/page.tsx', '390-604', 'Lookup/state ve operasyon tab akışları eklendi', 'Yüksek', 'Faz dışı', 'Evet'],
  ['/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/web/src/app/panel/ayarlar/kurulum/page.tsx', '446-576', 'Edit akışında screen-permissions ve insurance scopes okunuyor', 'Orta', 'Karışık', 'Evet; insurance scope Faz 1, hydrate scope faz dışı'],
  ['/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/web/src/app/panel/ayarlar/kurulum/page.tsx', '612-662', 'Save akışı buildUserPayload, service-areas, screen-permissions ve insurance-company-scopes çağrılarına bölündü', 'Yüksek', 'Karışık', 'Evet; Faz 1 çağrıları faz dışı scope payload ile karışık'],
  ['/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/web/src/app/panel/ayarlar/kurulum/page.tsx', '776-1629', 'Sekmeli kullanıcı modali, operasyon bölümleri ve modal genişleme refactor’u eklendi', 'Yüksek', 'Faz dışı', 'Evet; UI refactor + operasyon yapısı + Türkçeleştirme'],
];

const fazDisiRows = [
  ['/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/backend/src/modules/users/users.dto.ts', '5-28, 86-100', 'departmentMemberships / responsibilityAssignments', 'Faz 1 hedefi screen-permissions + insurance-company-scopes ile sınırlı; nested operasyon modeli ayrı fazın konusu', 'Temiz patch sadece screen-permissions ve insurance scope DTO’larını tutmalı'],
  ['/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/backend/src/modules/users/users.service.ts', '78-188, 251-392', 'departmentMemberships, responsibilityAssignments, role switch cleanup, isPrimary', 'Kullanıcı create/update mantığını operasyonel ilişki yönetimine ve cleanup davranışına genişletiyor; Faz 1 backend minimum değişiklik yaklaşımını aşıyor', 'Yüksek riskli veri davranışı değiştirdiği için patch dışında kalmalı'],
  ['/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/backend/src/modules/users/users.service.ts', '234-236', 'service-areas guard', 'Smoke test kapsamında zorunlu değil; Faz 1 ana hedefleriyle doğrudan ilişkili değil', 'Ayrı değerlendirme gerektirir'],
  ['/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/backend/src/modules/users/users.controller.ts', '35-35, 45-45, 71-71', 'CreateUserDto / UpdateUserDto tip geçişi', 'Bu tipler faz dışı nested alanları içeri taşıyor; controller yüzeyine faz dışı contract yansıtıyor', 'Faz 1 için daraltılmış DTO seti tercih edilmeli'],
  ['/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/web/src/app/panel/kullanicilar/page.tsx', '3-12, 32-46, 79-102, 194-550, 987-1244', 'UI refactor, operasyon scope, Türkçeleştirme, etki özeti', 'Tek dosyada modal mimarisi, sekmeler, lookup yüklemeleri ve operasyon bölümleri birlikte taşınıyor; Faz 1 için gereksiz yüzey alanı yaratıyor', 'Patch dışında bırakılarak sadece gerekli API payload/call hunkları ayrı alınmalı'],
  ['/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/web/src/app/panel/ayarlar/kurulum/page.tsx', '3-12, 78-134, 390-604, 776-1629', 'UI refactor, operasyon scope, Türkçeleştirme', 'Kurulum ekranındaki kullanıcı modali, Faz 1 backend uyumluluğu için gerekenden çok daha büyük UI değişikliği içeriyor', 'Patch dışında bırakılıp sadece gerekli canonical payload çağrıları alınmalı'],
  ['/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/backend/package.json', 'Jest moduleNameMapper hunk', 'Jest moduleNameMapper', 'Faz 1 kullanıcı ekran izinleri ve insurance scopes hedefiyle ilişkisiz test altyapısı değişikliği', 'Tamamen patch dışında kalmalı'],
];

const typecheckRows = [
  ['Stale Prisma client', 'Orta', '/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/node_modules/.prisma/client dizini yok; generate çıktısı eksik veya başka konumdan çözülüyor olabilir', 'Client kaynağını doğrula, gerekirse prisma generate', 'Evet'],
  ['Schema/client uyumsuzluğu', 'Yüksek', '/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/backend/prisma/schema.prisma içindeki ServiceType modelinde code alanı yok; buna rağmen typecheck code bekliyorsa generate edilen tipler schema ile hizalı değil', 'Schema beklentisini ve generate edilen client tiplerini eşleştir; gerekiyorsa schema kararı + generate', 'Evet'],
  ['Service kodu hatası', 'Düşük', '/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/backend/src/modules/service-types/service-types.service.ts satır 35 ve 71 code göndermiyor; mevcut schema da code içermiyor, bu yüzden tek başına service kodu kök neden görünmüyor', 'Ancak schema/client hizası doğrulanınca halen hata kalırsa service düzeltmesi düşünülür', 'Hayır'],
];

const smokeRows = [
  ['1', 'insurance-company-scopes valid', 'PUT /users/:id/insurance-company-scopes { insuranceCompanyIds: [\"uuid1\"] }', '200, userInsuranceCompanyScope kaydı oluşur', 'Düşük'],
  ['2', 'insurance-company-scopes invalid', 'PUT /users/:id/insurance-company-scopes { insuranceCompanyIds: [\"invalid\"] }', '400, geçersiz UUID veya sigorta şirketi kimliği reddedilir', 'Düşük'],
  ['3', 'insurance-company-scopes empty', 'PUT /users/:id/insurance-company-scopes { insuranceCompanyIds: [] }', '200, mevcut scope kayıtları silinir', 'Düşük'],
  ['4', 'screen-permissions legacy', 'PUT /users/:id/screen-permissions { screenPermissions: [{ screenCode: \"x\", canView: true }] }', '200, normalize edilip kaydedilir', 'Düşük'],
  ['5', 'screen-permissions canonical', 'PUT /users/:id/screen-permissions { screens: [{ code: \"x\", canView: true }] }', '200, kaydedilir', 'Düşük'],
  ['6', 'GET screen-permissions', 'GET /users/:id/screen-permissions?roleCode=field_staff', 'Doğru matrix ve fallback defaultlar döner', 'Düşük'],
  ['7', 'Regression users create', 'POST /users minimum payload; ardından gerekiyorsa Faz 1 endpointleri ayrı çağrılır', '201, kullanıcı oluşur; Faz dışı nested relation zorunluluğu olmamalı', 'Orta'],
  ['8', 'Regression users update', 'PUT /users/:id temel alanlar ile', '200, temel alanlar güncellenir; Faz dışı cleanup yan etkisi oluşmamalı', 'Orta'],
];

const approvalRows = [
  ['Kapı 1', 'Temiz Faz 1 patch kapsamı', 'Sadece screen-permissions normalize + insurance-company-scopes + gerekli minimal frontend çağrıları alınsın mı?', 'Danışman onayı gerekli'],
  ['Kapı 2', 'ServiceType blocker çözümü', 'Schema/client hizası için prisma generate veya schema kararı açılacak mı?', 'Ayrı onay gerekli'],
  ['Kapı 3', 'Faz dışı operasyon kapsamı', 'departmentMemberships / responsibilityAssignments / role switch cleanup daha sonra ayrı patch olacak mı?', 'Ayrı onay gerekli'],
  ['Kapı 4', 'Smoke test icrası', 'Temiz patch sonrası local/staging testleri kim ve hangi ortamda koşturacak?', 'İşletim onayı gerekli'],
];

const children = [
  p('Faz 1 Patch Detay Karar Raporu', { heading: HeadingLevel.TITLE, bold: true, size: 30, after: 220 }),
  p('1. Yönetici Özeti', { heading: HeadingLevel.HEADING_1, bold: true, size: 26 }),
  p('Bu rapor, ilgili 5 hedef dosyadaki tüm hunks için faz içi / faz dışı ayrımını, typecheck blocker kök neden tablosunu, ServiceType mini patch kararını ve temiz patch sonrası smoke test planını bir araya getirir. İnceleme sonucunda Faz 1 kapsamı yalnız screen-permissions uyumluluğu ile insurance-company-scopes akışında netleşmiş; departmentMemberships, responsibilityAssignments, role switch cleanup, isPrimary, büyük UI refactor, Türkçeleştirme ve Jest moduleNameMapper değişiklikleri faz dışı olarak sınıflandırılmıştır.'),
  bullet('Temiz patch için backendde yalnız users.controller.ts içindeki normalize + insurance-company-scopes route ile users.service.ts içindeki screen-permissions guard ve updateInsuranceCompanyScopes metodu tutulmalıdır.'),
  bullet('users.dto.ts içinde yalnız screen-permissions ve insurance-company-scopes için gereken DTO blokları tutulmalı; nested relation DTO’ları dışarıda kalmalıdır.'),
  bullet('Typecheck blocker için baskın kök neden schema/client uyumsuzluğu olarak görünmektedir; service-types.service.ts yalnız temas noktasıdır.'),
  p('2. Faz 1 Patch / Hunk Listesi (Detaylı)', { heading: HeadingLevel.HEADING_1, bold: true, size: 26 }),
  makeTable(
    ['Dosya yolu', 'Satır', 'Amaç', 'Risk', 'Durum', 'Faz dışı bağımlılık'],
    fazRows,
    [2500, 800, 2200, 700, 1100, 2000],
  ),
  new Paragraph({ children: [new PageBreak()] }),
  p('3. Faz Dışı Değişikliklerin Patch Dışında Kaldığı Kanıtı', { heading: HeadingLevel.HEADING_1, bold: true, size: 26 }),
  makeTable(
    ['Dosya yolu', 'Satır', 'Faz dışı konu', 'Neden faz dışı', 'Patch dışında kalma gerekçesi'],
    fazDisiRows,
    [2200, 900, 1500, 2300, 2400],
  ),
  p('4. Typecheck Blocker Kök Neden Karar Tablosu', { heading: HeadingLevel.HEADING_1, bold: true, size: 26 }),
  makeTable(
    ['Kök Neden', 'Olasılık', 'Kanıt', 'Çözüm', 'Ayrı Onay Gerekli mi?'],
    typecheckRows,
    [1600, 850, 3100, 2200, 1550],
  ),
  p('Detaylı analiz notu: /Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/backend/src/modules/service-types/service-types.service.ts satır 35 ve 71 create payloadlarında code alanı yoktur. /Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/backend/prisma/schema.prisma içinde mevcut ServiceType modelinde de code alanı bulunmamaktadır. Buna rağmen typecheck code bekliyorsa, baskın senaryo schema ile generate edilmiş Prisma tipleri arasında hizasızlıktır.'),
  p('5. ServiceType Mini Patch Planı (Ayrı Patch)', { heading: HeadingLevel.HEADING_1, bold: true, size: 26 }),
  bullet('Etkilenen dosya: /Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/backend/src/modules/service-types/service-types.service.ts'),
  bullet('Amaç: code alanı beklentisinin service kodundan mı, generate edilmiş Prisma client tiplerinden mi kaynaklandığını ayırmak.'),
  bullet('Schema değişikliği gerekir mi?: Mevcut kanıta göre hayır; önce schema/client hizası doğrulanmalı.'),
  bullet('Prisma generate gerekir mi?: Evet, yüksek olasılıkla ayrı onay gerektiren doğrulama adımıdır.'),
  bullet('Risk seviyesi: Orta; yanlış çözüm seçilirse gereksiz schema değişikliğine veya yanlış client yenilemesine yol açabilir.'),
  bullet('Rollback planı: Ayrı mini patch yalnız service-types.service.ts ile sınırlandırılır; schema değiştirilmedikçe rollback tek dosyalık geri alım olarak yapılır.'),
  p('6. Local / Staging Smoke Test Planı', { heading: HeadingLevel.HEADING_1, bold: true, size: 26 }),
  makeTable(
    ['#', 'Senaryo', 'Adımlar', 'Beklenen Sonuç', 'Risk'],
    smokeRows,
    [500, 1700, 3400, 2500, 700],
  ),
  p('Not: Local ve staging test checklist’i aynı kalmalıdır; yalnız test verisi, kullanıcı ID ve rolCode önkoşulları ortam bazında güncellenmelidir.'),
  p('7. Bir Sonraki Onay Kapısı Tablosu', { heading: HeadingLevel.HEADING_1, bold: true, size: 26 }),
  makeTable(
    ['Kapı', 'Konu', 'Karar sorusu', 'Durum'],
    approvalRows,
    [900, 1800, 4300, 1800],
  ),
  p('8. Açık Beyan', { heading: HeadingLevel.HEADING_1, bold: true, size: 26 }),
  bullet('Bu çalışma kapsamında deploy, rebuild, migration, seed, prisma generate, veri temizliği ve Faz 2 uygulaması yapılmamıştır.'),
  bullet('Rapor, yalnız mevcut çalışma ağacındaki diff ve okunabilen proje dosyaları üzerinden hazırlanmıştır.'),
  bullet('Faz 1 temiz patch için öneri; büyük karışık hunkların seçilerek değil, yeni temiz minimal patch olarak yeniden üretilmesidir.'),
];

const doc = new Document({
  creator: 'Verdent',
  title: 'Faz 1 Patch Detay Karar Raporu',
  description: 'Temiz patch detaylandırma, typecheck karar tablosu ve smoke test planı',
  styles: {
    default: {
      document: {
        run: {
          font: 'Arial',
          size: 22,
        },
        paragraph: {
          spacing: { line: 276 },
        },
      },
    },
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1000, right: 900, bottom: 1000, left: 900 },
        },
      },
      children,
    },
  ],
});

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(outputPath, buffer);
  process.stdout.write(outputPath);
});