const fs = require('fs');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ShadingType,
  Header,
  Footer,
  PageBreak,
} = require('docx');

const outputPath =
  '/Users/mustafayufkayurek/Desktop/TEST_NOTLARI_MODULU_KONTROLLU_UYGULAMA_PLANI_20260522.docx';

const theme = {
  primary: '1F4E78',
  accent: 'D9EAF7',
  border: 'B7C9D6',
  muted: '5B6570',
  light: 'F7FAFC',
  danger: 'A61B1B',
  success: '166534',
};

function text(value, options = {}) {
  return new TextRun({
    text: value,
    ...options,
  });
}

function paragraph(children, options = {}) {
  const runs = Array.isArray(children) ? children : [text(children, options.textOptions || {})];
  return new Paragraph({
    children: runs,
    spacing: options.spacing || { after: 100 },
    alignment: options.alignment,
    heading: options.heading,
    bullet: options.bullet,
    numbering: options.numbering,
    indent: options.indent,
    thematicBreak: options.thematicBreak,
  });
}

function title(value) {
  return paragraph([text(value, { bold: true, size: 34, color: theme.primary })], {
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 220, after: 120 },
  });
}

function subtitle(value) {
  return paragraph([text(value, { bold: true, size: 26, color: '153A5B' })], {
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 160, after: 100 },
  });
}

function bullet(value, level = 0) {
  return paragraph(value, { bullet: { level }, spacing: { after: 60 } });
}

function numbered(value, level = 0) {
  return paragraph(value, {
    numbering: { reference: 'main-numbering', level },
    spacing: { after: 60 },
  });
}

function makeTable(rows, widths) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(
      (row, rowIndex) =>
        new TableRow({
          children: row.map(
            (cell, cellIndex) =>
              new TableCell({
                width:
                  widths && widths[cellIndex]
                    ? { size: widths[cellIndex], type: WidthType.PERCENTAGE }
                    : undefined,
                shading:
                  rowIndex === 0
                    ? { fill: theme.primary, type: ShadingType.CLEAR, color: 'auto' }
                    : rowIndex % 2 === 0
                      ? { fill: theme.light, type: ShadingType.CLEAR, color: 'auto' }
                      : undefined,
                borders: {
                  top: { style: BorderStyle.SINGLE, color: theme.border, size: 4 },
                  bottom: { style: BorderStyle.SINGLE, color: theme.border, size: 4 },
                  left: { style: BorderStyle.SINGLE, color: theme.border, size: 4 },
                  right: { style: BorderStyle.SINGLE, color: theme.border, size: 4 },
                },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: cell,
                        bold: rowIndex === 0,
                        color: rowIndex === 0 ? 'FFFFFF' : '1F2937',
                        size: 21,
                      }),
                    ],
                    spacing: { before: 50, after: 50 },
                  }),
                ],
              }),
          ),
        }),
    ),
  });
}

const content = [];

content.push(
  paragraph([text('TEST NOTLARI VE GÖREV TAKİP MODÜLÜ', { bold: true, size: 36, color: theme.primary })], {
    alignment: AlignmentType.CENTER,
    spacing: { before: 180, after: 60 },
  }),
  paragraph([text('Kontrollü Uygulama Planı', { italics: true, size: 24, color: theme.muted })], {
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
  }),
  makeTable(
    [
      ['Belge Bilgisi', 'İçerik'],
      ['Tarih', '22.05.2026'],
      ['Teslim Türü', 'Tek Word dosyası; kod, migration ve deploy içermeyen kontrollü uygulama planı'],
      ['İncelenen Kaynaklar', 'Proje kod tabanı, mevcut route/yetki/export yapısı ve revize tasarım planı'],
      ['Teslim Dosyası', outputPath],
      ['Sınır', 'Bu belge uygulama onayı değildir; yalnız plan, etki ve doğrulama çerçevesi sunar'],
    ],
    [28, 72],
  ),
  paragraph(
    'Bu belge, mevcut projedeki gerçek klasör ve dosya yapısı incelenerek hazırlanmıştır. Kod yazılmamış, migration oluşturulmamış ve deploy yapılmamıştır. İçerik; ürün kuralları, backend/frontend temas noktaları, yetki modeli, test kapsamı, rollback ve production öncesi onay kapısını tek raporda birleştirir.',
    { spacing: { before: 130, after: 180 } },
  ),
  title('Yönetici Özeti'),
);

[
  'Yeni ekran için en uyumlu konum, mevcut admin odaklı ayarlar kümesine paralel olarak `/panel/ayarlar/test-notlari-gorev-takip` route’udur.',
  'Yetki kurgusu hem frontend route/menu görünürlüğü hem de backend guard/decorator düzeyinde admin-only tasarlanmalıdır; yalnız UI gizleme yeterli değildir.',
  'Excel export için mevcut backendde kullanılan `ExcelJS` deseni yeniden kullanılmalıdır; bu sayede yeni bağımlılık veya ayrı export altyapısı ihtiyacı oluşmaz.',
  'Dosya/kanıt alanları için mevcut `uploads` ve `file-documents` altyapısının entity bazlı genişletilmesi, projedeki belge yönetimi yaklaşımıyla daha uyumludur.',
  'Modül geçici olduğu için ilk günden `isArchived` odaklı soft delete/arsivleme planı tanımlanmalı; kalıcı görev modülü geldiğinde kontrollü kapatma kolaylaşmalıdır.',
].forEach((item) => content.push(bullet(item)));

content.push(title('1. Uygulanacak Ekranlar ve Sekmelerin Kesin Listesi'));
content.push(
  paragraph(
    'Mevcut frontend yapısında admin ekranları `apps/web/src/app/panel/layout.tsx` üzerinden role ve screen erişimi ile yönetiliyor. Ayarlar grubu içinde yeni bir admin-only sayfa açılması, mevcut navigasyon modeline en az sürtünme ile uyum sağlar.',
  ),
  makeTable(
    [
      ['Öğe', 'Plan'],
      ['Admin route', '/panel/ayarlar/test-notlari-gorev-takip'],
      ['Menü konumu', 'Ayarlar dropdown altında yeni link; yalnız admin rolünde görünür'],
      ['Sayfa başlığı', 'Test Notları ve Görev Takip'],
      ['Sayfa tipi', 'Geçici, admin-only, ileride kalıcı modüle devredilecek operasyon ekranı'],
      ['Sekmeler', 'Test Notları, İşler/Kararlar, Danışman Formatı, Excel/Rapor'],
    ],
    [24, 76],
  ),
  subtitle('Sekme bazlı wireframe ve layout'),
  makeTable(
    [
      ['Sekme', 'Wireframe / layout açıklaması'],
      ['Test Notları', 'Üstte filtre şeridi ve “Yeni Test Notu” aksiyonu; solda liste/tablo, sağda seçili kaydın form/detay paneli. Ana alanlar: test no, modül, gözlem, beklenen davranış, öncelik, durum, tekrar durumu, kanıtlar.'],
      ['İşler/Kararlar', 'Üstte durum/öncelik/sorumlu filtreleri; orta alanda sıra numaralı tablo; sağ panelde iş detayı, kapanış notu, hedef tarih, hatırlatma ve kanıt referansları. Tamamlanan satırlar gri/çizili görünür.'],
      ['Danışman Formatı', 'Sol tarafta test notu seçici liste; ortada 7 adımlı dönüştürülmüş öneri; sağda onay durumu, işe dönüştürme aksiyonu ve kabul kriteri/kanıt özeti. Kullanıcı onayı olmadan “talimat” niteliği kazanmaz.'],
      ['Excel/Rapor', 'Filtre kartı, sheet ön izlemesi, indirilecek kapsam özeti ve “Excel İndir” butonu. Alt bölümde son üretilen rapor parametreleri veya rapor geçmişi için yer ayrılır.'],
    ],
    [18, 82],
  ),
  subtitle('Sayfa düzeni kararı'),
  bullet('Masaüstünde 12 kolon grid ile 8/4 veya 7/5 split layout önerilir.'),
  bullet('Tablet görünümünde filtre alanı üstte, liste ve form alt alta akmalıdır.'),
  bullet('Mobil görünümde sekme şeridi yatay kaydırmalı veya dropdown fallback ile çalışmalıdır.'),
  bullet('Başlık alanında geçici/admin-only uyarısı görünür olmalıdır; kalıcı modülde kaldırılacağı net biçimde belirtilmelidir.'),
);

content.push(title('2. Backend Tablo / Model / Migration Planı'));
content.push(
  paragraph(
    'Prisma şeması incelendiğinde yeni alanların mevcut `User` modeliyle relation bazlı eklenmesi uygundur. Mevcut tablolara yeni business kolon eklemek yerine üç bağımsız tablo ile modülün izole tutulması, ileride kaldırma/arşivleme senaryosunu kolaylaştırır.',
  ),
  subtitle('Önerilen tablolar'),
  makeTable(
    [
      ['Tablo', 'Alan planı'],
      [
        'WorkItem',
        'id UUID PK; sequenceNo Int unique; title String; sourceType String/enum; priority String/enum; status String/enum; ownerUserId String FK User; dueAt DateTime nullable; reminderAt DateTime nullable; userComment String nullable; closureNote String nullable; sourceTestNoteId String nullable FK TestNote; evidenceSummary String nullable; isArchived Boolean default false; archivedAt DateTime nullable; createdByUserId String FK User; updatedByUserId String nullable FK User; createdAt DateTime default now; updatedAt DateTime updatedAt',
      ],
      [
        'TestNote',
        'id UUID PK; testNo String unique; moduleCode String; userObservation String; expectedBehavior String; screenshotSummary String nullable; priority String/enum; status String/enum; isRepeat Boolean default false; linkedWorkItemCount Int default 0; createdByUserId String FK User; assignedToUserId String nullable FK User; isArchived Boolean default false; archivedAt DateTime nullable; createdAt DateTime default now; updatedAt DateTime updatedAt',
      ],
      [
        'TestNoteFormat',
        'id UUID PK; testNoteId String FK TestNote; versionNo Int default 1; plainSummary String; expectedBehaviorText String; impactClass String; prioritySuggestion String; engineeringInstruction String; acceptanceCriteria String; evidenceExpectation String; isApproved Boolean default false; approvedByUserId String nullable FK User; approvedAt DateTime nullable; createdAt DateTime default now; updatedAt DateTime updatedAt',
      ],
    ],
    [16, 84],
  ),
  subtitle('Alan bazlı nullable, default, FK ve index planı'),
  makeTable(
    [
      ['Tablo.Alan', 'Tip', 'Nullable', 'Default', 'FK / Index'],
      ['WorkItem.sequenceNo', 'Int', 'Hayır', 'Otomatik sıra', 'Unique index'],
      ['WorkItem.ownerUserId', 'String', 'Hayır', '-', 'FK → User.id, index'],
      ['WorkItem.sourceTestNoteId', 'String', 'Evet', 'null', 'FK → TestNote.id, index'],
      ['WorkItem.status', 'String/enum', 'Hayır', 'OPEN', 'Index'],
      ['WorkItem.priority', 'String/enum', 'Hayır', 'P2', 'Index'],
      ['WorkItem.isArchived', 'Boolean', 'Hayır', 'false', 'Index'],
      ['TestNote.testNo', 'String', 'Hayır', 'Sistem üretir', 'Unique index'],
      ['TestNote.moduleCode', 'String', 'Hayır', '-', 'Index'],
      ['TestNote.createdByUserId', 'String', 'Hayır', '-', 'FK → User.id, index'],
      ['TestNote.assignedToUserId', 'String', 'Evet', 'null', 'FK → User.id, index'],
      ['TestNote.status', 'String/enum', 'Hayır', 'NEW', 'Index'],
      ['TestNote.priority', 'String/enum', 'Hayır', 'P2', 'Index'],
      ['TestNote.isArchived', 'Boolean', 'Hayır', 'false', 'Index'],
      ['TestNoteFormat.testNoteId', 'String', 'Hayır', '-', 'FK → TestNote.id, index'],
      ['TestNoteFormat.isApproved', 'Boolean', 'Hayır', 'false', 'Index'],
      ['TestNoteFormat.approvedByUserId', 'String', 'Evet', 'null', 'FK → User.id'],
    ],
    [28, 16, 12, 14, 30],
  ),
  subtitle('Soft delete / arşiv mantığı'),
  bullet('Her üç tabloda ana silme stratejisi fiziksel delete değil `isArchived` temelli soft archive olmalıdır.'),
  bullet('Aktif ekranlar varsayılan olarak `isArchived = false` filtrelemelidir.'),
  bullet('Arşivlenen kayıtlar okunabilir kalmalı; düzenleme ve export varsayılan kapsamı dışında tutulmalıdır.'),
  bullet('Kalıcı modüle geçişte veri kaybını azaltmak için `archivedAt` ve tercihen `archivedByUserId` alanları planlanmalıdır.'),
  subtitle('Migration dosya adı ve sırası'),
  makeTable(
    [
      ['Sıra', 'Önerilen migration adı', 'Amaç'],
      ['1', '20260523_create_test_notes_work_items_formats', 'Üç ana tablo, relation ve indexlerin eklenmesi'],
      ['2', '20260523_extend_documents_and_permissions_for_test_notes', 'Entity/document veya permission genişletmesi gerekiyorsa ikinci adım'],
      ['3', '20260523_seed_test_notes_screen_permission', 'Yeni screen/permission kayıtlarının seed edilmesi'],
    ],
    [10, 42, 48],
  ),
  subtitle('Mevcut tablolara etkisi'),
  bullet('`apps/backend/prisma/schema.prisma` içindeki `User` modeline yalnız relation alanları eklenir; mevcut kullanıcı alanları değişmez.'),
  bullet('Belge/kanıt için mevcut entity document/file asset akışı kullanılırsa entity type kapsamı genişleyebilir.'),
  bullet('Mevcut `tasks` modülünü doğrudan yeniden kullanmak yerine bağımsız `WorkItem` planı tercih edildi; çünkü geçici modül daha sonra arşivlenebilmeli ve kalıcı görev domaininden bağımsız kaldırılabilmelidir.'),
);

content.push(title('3. Frontend Sayfa ve Komponent Planı'));
content.push(
  subtitle('Route yapısı ve dosya ağacı'),
  makeTable(
    [
      ['Katman', 'Planlanan dosya/ağaç'],
      ['Route', 'apps/web/src/app/panel/ayarlar/test-notlari-gorev-takip/page.tsx'],
      ['Sekme container', 'apps/web/src/components/test-notes-work-items/TestNotesWorkItemsPage.tsx'],
      ['Tab bileşenleri', 'TestNotesTab.tsx, WorkItemsTab.tsx, ConsultantFormatTab.tsx, ExcelReportTab.tsx'],
      ['Ortak UI', 'FiltersBar.tsx, StatusBadge.tsx, EvidenceUploader.tsx, DetailDrawer.tsx, EmptyState.tsx'],
      ['API katmanı', 'apps/web/src/lib veya apps/web/src/services altında modüle özel client fonksiyonları'],
      ['Tipler', 'apps/web/src/types/test-notes-work-items.ts'],
    ],
    [24, 76],
  ),
  subtitle('Komponent hiyerarşisi'),
  bullet('`page.tsx` → auth + layout wrapper + page container'),
  bullet('`TestNotesWorkItemsPage` → sekme state, ortak filtre state, summary kartları'),
  bullet('Sekme bileşenleri → kendi tablo/form/detay panelleri'),
  bullet('Alt bileşenler → durum etiketi, dosya yükleme alanı, satır aksiyonları, dönüşüm ön izlemesi'),
  subtitle('Sekme bazlı UI planı'),
  makeTable(
    [
      ['Sekme', 'Tablo', 'Form', 'Filtre', 'Durum etiketi'],
      ['Test Notları', 'Test No, Modül, Öncelik, Durum, Tekrar, Oluşturan', 'Yeni/düzenle formu sağ panelde', 'Modül, durum, öncelik, tekrar, tarih', 'Yeni, İncelemede, Düzeltme Bekliyor, Canlıda, Kabul, Backlog'],
      ['İşler/Kararlar', 'Sıra No, Konu, Kaynak, Öncelik, Sorumlu, Hedef Tarih, Durum', 'Detay ve kapanış formu', 'Durum, öncelik, sorumlu, gecikenler, kaynak', 'Açık, Devam Ediyor, Tamamlandı, İptal'],
      ['Danışman Formatı', 'Bağlı Test No, Etki Sınıfı, Öncelik, Onay', '7 adımlı öneri düzenleyici/ön izleme', 'Onay durumu, öncelik, etki sınıfı', 'Öneri, Onay Bekliyor, Onaylandı'],
      ['Excel/Rapor', 'Son export kayıtları veya parametre özeti', 'Filtre formu ve export aksiyonu', 'Tarih, durum, sorumlu, modül', 'Hazır, Oluşturuluyor, İndirildi'],
    ],
    [18, 24, 22, 20, 16],
  ),
  subtitle('Dosya / kanıt yükleme alanları'),
  bullet('Kanıt alanı için mevcut `uploads/presign` ve `uploads/file-assets/complete` akışı veya `file-documents` entity tabanlı yaklaşım kullanılmalıdır.'),
  bullet('Frontend upload bileşeni çoklu dosya, link ve dosya adı görünümü desteklemelidir.'),
  bullet('Desteklenen uzantılar mevcut belge desenine paralel `.pdf, .jpg, .jpeg, .png, .doc, .docx, .xls, .xlsx` ile sınırlandırılabilir.'),
  bullet('Kanıt yükleme zorunlu olmamalı; ancak local/staging doğrulamada kritik kayıtlar için öneri etiketi bulunmalıdır.'),
);

content.push(title('4. Excel Export Planı'));
content.push(
  paragraph(
    'Mevcut export altyapısı `apps/backend/src/modules/dashboard/export.service.ts` içinde `ExcelJS.Workbook` ile yönetiliyor. Bu desen korunarak yeni modül için ayrı service/controller endpointleri planlanmalıdır.',
  ),
  subtitle('Kapsanacak sekmeler'),
  bullet('Test Notları'),
  bullet('İşler/Kararlar'),
  bullet('Danışman Formatı'),
  paragraph('Ürün kuralı gereği Excel kapsamı tam olarak bu üç sekmeyi içermelidir; ayrı bir özet sheet eklenmesi faydalıdır ancak temel kapsamı genişletmez.'),
  subtitle('Sheet bazlı kolon planı'),
  makeTable(
    [
      ['Sheet', 'Kolonlar'],
      ['Test Notları', 'Sıra, Test No, Modül, Kullanıcı Gözlemi, Beklenen Davranış, Öncelik, Durum, Tekrar Durumu, Oluşturan, Oluşturma Tarihi, Son Güncelleme, Kanıt Sayısı'],
      ['İşler/Kararlar', 'Sıra, İş No/SequenceNo, Konu, Kaynak, Öncelik, Sorumlu, Hedef Tarih, Hatırlatma, Durum, Kullanıcı Yorumu, Kapanış Notu, Kanıt Var/Yok'],
      ['Danışman Formatı', 'Sıra, Bağlı Test No, Sorun Özeti, Beklenen Davranış, Etki Sınıfı, Öncelik, Mühendislik Talimatı, Kabul Kriteri, Kanıt Beklentisi, Onay Durumu'],
      ['Özet', 'Toplam kayıtlar, açık kayıtlar, backlog, tamamlanan iş, onaysız danışman formatı, tekrar eden test notları'],
    ],
    [18, 82],
  ),
  subtitle('Filtreler ve sıra numarası'),
  bullet('Export filtreleri: tarih aralığı, durum, öncelik, modül, sorumlu, arşiv dahil/dahil değil.'),
  bullet('Excel’de ilk kolon görünür sıra numarası olmalı; tablo satır indeksinden değil, iş/test kimliğinden türetilen işsel sıra kullanılmalıdır.'),
  bullet('Varsayılan sıralama Test Notları için `createdAt desc`, İşler için `sequenceNo asc`, Danışman Formatı için `updatedAt desc` önerilir.'),
  subtitle('Backend endpoint ve response yapısı'),
  makeTable(
    [
      ['Öğe', 'Plan'],
      ['Controller path', 'apps/backend/src/modules/test-notes-work-items/test-notes-work-items.controller.ts içinde `GET/POST export` aksiyonu'],
      ['Önerilen endpoint', '/test-notes-work-items/export.xlsx'],
      ['Request', 'Query veya body üzerinden filtre DTO'],
      ['Response', 'Excel binary buffer + content-type `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`'],
      ['Service', 'Ayrı export service veya modül servisi içinde workbook builder fonksiyonları'],
    ],
    [24, 76],
  ),
);

content.push(title('5. Danışman Formatı Üretim Template’i'));
content.push(
  paragraph(
    'Bu alan ürün kuralı gereği “öneri” niteliğindedir; kullanıcı veya danışman onayı olmadan uygulama talimatı sayılmaz. Bu nedenle veri modeli ve UI dili “önerilen dönüşüm” çerçevesinde tasarlanmalıdır.',
  ),
  subtitle('7 adımlı dönüşüm akışı'),
  makeTable(
    [
      ['Adım', 'Template yapısı'],
      ['1', 'Sorunun sade özeti: “Kullanıcı şu davranışı gözlemledi: …”'],
      ['2', 'Beklenen davranış: “Sistem şu anda … yerine … yapmalıdır.”'],
      ['3', 'Etki sınıfı: “Etki alanı: operasyon | finans | müşteri güveni | yetki | performans”'],
      ['4', 'Öncelik: “Önerilen öncelik: P0/P1/P2/Karar Gerekli”'],
      ['5', 'Mühendislik talimatı: “Muhtemel temas noktaları: ekran/API/veri modeli/izin akışı”'],
      ['6', 'Kabul kriteri: “PASS için teknik sonuç + kullanıcı beklentisi + ekran davranışı birlikte doğrulanır”'],
      ['7', 'Kanıt beklentisi: “Beklenen teslim: ekran görüntüsü, API sonucu, export çıktısı, akış doğrulaması”'],
    ],
    [10, 90],
  ),
  subtitle('Örnek input → output'),
  makeTable(
    [
      ['Tür', 'İçerik'],
      ['Input', '“Tahsilat ekledikten sonra finans toplamı hemen değişmiyor, sayfayı yenileyince düzeliyor.”'],
      ['Output / Sorun özeti', 'Tahsilat kaydı sonrasında finans toplam kartları anlık güncellenmiyor.'],
      ['Output / Beklenen davranış', 'Yeni tahsilat kaydı eklendiğinde finans özet alanları sayfa yenilemeye gerek kalmadan güncellenmelidir.'],
      ['Output / Etki ve öncelik', 'Etki: finans + kullanıcı güveni, Öncelik: P1'],
      ['Output / Mühendislik talimatı', 'Finans ekranı veri tazeleme akışı, mutation sonrası query invalidation ve özet kart API dönüşleri kontrol edilmelidir.'],
      ['Output / Kabul kriteri', 'Tahsilat kaydından sonra liste ve özet kartları aynı akış içinde güncel değeri göstermelidir.'],
      ['Output / Kanıt', 'Tahsilat öncesi/sonrası ekran görüntüsü ve ilgili API cevabı'],
    ],
    [24, 76],
  ),
  subtitle('Frontend’de gösterim planı'),
  bullet('Sol panelde ham test notu, sağ panelde 7 maddelik danışman formatı önerisi gösterilir.'),
  bullet('Her madde satır bazında düzenlenebilir ama başlangıçta öneri etiketi taşır.'),
  bullet('Üstte açık uyarı metni yer almalıdır: “Bu içerik öneridir, onaysız talimat değildir.”'),
  bullet('Onay verildiğinde `isApproved`, `approvedByUserId`, `approvedAt` alanları güncellenir; yeni WorkItem oluşturma aksiyonu isteğe bağlı tetiklenir.'),
);

content.push(title('6. Yetki ve Admin-Only Kontrol Planı'));
content.push(
  subtitle('Backend planı'),
  bullet('Guard zinciri: mevcut `JwtAuthGuard` + `PermissionsGuard` deseni korunmalıdır.'),
  bullet('Yeni controller üzerinde `@UseGuards(JwtAuthGuard, PermissionsGuard)` ve modüle özel permission decorator kullanımı planlanmalıdır.'),
  bullet('Permission kodu için iki seçenek değerlendirildi: yeni özel `test_notes.manage` veya mevcut sistem yönetimi şemsiyesi altında alt izin. Ayrı modül izlenebilirliği için özel izin daha uygun bulundu.'),
  bullet('Screen code planı: mevcut screen permission desenine paralel yeni bir kod eklenmeli; frontend ve backend aynı anahtar üzerinden konuşmalıdır.'),
  subtitle('Frontend planı'),
  bullet('`apps/web/src/utils/screen-permissions.ts` içine yeni screen code ve label eklenir.'),
  bullet('`apps/web/src/app/panel/layout.tsx` içindeki `ROUTE_ACCESS`, `NAV_ITEM_ACCESS` ve `SCREEN_TO_PATH` bloklarına yeni route/screen eşlemesi eklenir.'),
  bullet('Ayarlar dropdown içinde link yalnız admin görünürlüğü ile render edilir.'),
  subtitle('Menü görünürlüğü'),
  bullet('Admin kullanıcı: menüyü görür, route’a gidebilir, API erişimi alır.'),
  bullet('Admin olmayan iç kullanıcı: menü görünmez; doğrudan route erişiminde frontend redirect veya erişim reddi olur.'),
  bullet('Dış portal rollerinde menü de endpoint de tamamen kapalı kalır.'),
  subtitle('Yetkisiz erişim testi senaryosu'),
  makeTable(
    [
      ['Senaryo', 'Beklenen sonuç'],
      ['Admin olmayan kullanıcı route’a gider', 'Frontend erişim engeli veya ilgili 403/redirect davranışı'],
      ['Admin olmayan kullanıcı API çağırır', 'Backend 403 döner'],
      ['Dış portal rolü menüyü kontrol eder', 'Menü öğesi render edilmez'],
      ['Screen permission listesinde ekran kapalı', 'DB tabanlı screen kontrolü route görünürlüğünü engeller'],
    ],
    [36, 64],
  ),
);

content.push(title('7. Local / Staging Test Senaryoları'));
content.push(
  paragraph(
    'Canlı öncesi local doğrulama zorunlu olduğundan test planı ürün akışları ve yetki senaryolarını kapsamalıdır. Buradaki testler plan niteliğindedir; henüz uygulanmamıştır.',
  ),
  subtitle('CRUD testleri'),
  bullet('Test Note create: sade dil ile kayıt açılmalı, test no sistem tarafından üretilmelidir.'),
  bullet('Test Note read/list: filtreler ve durum etiketleri doğru görünmelidir.'),
  bullet('Test Note update: durum, öncelik ve kanıt alanı güncellenebilmelidir.'),
  bullet('Delete yerine archive: kayıt listeden kalkmalı fakat arşiv filtresi ile okunabilmelidir.'),
  bullet('WorkItem create/update/archive: sequenceNo sabit kalmalı, durum akışı ve kapanış notu doğrulanmalıdır.'),
  subtitle('Excel export testi'),
  bullet('Üç ana sheet (`Test Notları`, `İşler/Kararlar`, `Danışman Formatı`) üretilmelidir.'),
  bullet('Filtre uygulandığında export içeriği filtreyle uyumlu olmalıdır.'),
  bullet('Uzun metin kolonlarında veri kesilmemeli; workbook açılabilir olmalıdır.'),
  subtitle('Danışman formatı dönüşüm testi'),
  bullet('Ham test notu 7 alanlı öneri çıktısına dönüşmelidir.'),
  bullet('Onay verilmeden WorkItem oluşturulmamalıdır.'),
  bullet('PASS tanımı teknik + kullanıcı beklentisi + ekran davranışı olarak yer almalıdır.'),
  subtitle('Yetki testi'),
  bullet('Admin kullanıcı tam erişim alır.'),
  bullet('Non-admin kullanıcı route ve endpoint düzeyinde engellenir.'),
  bullet('Menü görünürlüğü ve API koruması birlikte doğrulanır.'),
  subtitle('Kanıt ekleme testi'),
  bullet('Desteklenen dosya türlerinde upload tamamlanır, kayıtla ilişki görünür.'),
  bullet('Yüklenen kanıt listede ve detay panelinde erişilebilir olmalıdır.'),
  subtitle('Durum değişimi testi'),
  bullet('Test Note ve WorkItem durum rozetleri doğru renk/metin ile güncellenmelidir.'),
  bullet('Tamamlanan iş görsel olarak gri/çizili olur.'),
  bullet('Arşivlenen kayıtlar aktif listeden çıkar, arşiv görünümünde kalır.'),
);

content.push(title('8. Rollback Planı'));
content.push(
  subtitle('Migration geri alma adımları'),
  bullet('Uygulama aşamasında migration ayrı paketler halinde tutulmalı; rollback için tablo ekleme ve permission/screen seed adımları ayrıştırılmalıdır.'),
  bullet('İlk rollback önceliği yeni endpoint ve menü görünürlüğünün kapatılmasıdır; veri varsa okunabilir arşiv korunmalıdır.'),
  bullet('DB rollback yalnız veri kaybı riski net değerlendirildikten sonra planlanmalıdır; fiziksel silme son seçenek olmalıdır.'),
  subtitle('Feature flag / menüden kapatma'),
  bullet('Frontend’de route linki ve ekran görünürlüğü tek noktadan kapatılabilecek şekilde tasarlanmalıdır.'),
  bullet('Backend’de controller route erişimi permission veya config bazlı devre dışı bırakılabilir.'),
  subtitle('Eski akışa dönüş'),
  bullet('Yeni modül kapatıldığında ekip, mevcut manuel Word/Excel rapor akışına geri dönebilir.'),
  bullet('Kanıt dosyaları mevcut storage yapısında kaldığı için referanslar kaybolmamalıdır.'),
  subtitle('Veri kaybı riski analizi'),
  makeTable(
    [
      ['Risk', 'Seviye', 'Açıklama'],
      ['Yeni tabloların silinmesi', 'Yüksek', 'Arşivlenmiş karar ve test notları tamamen kaybolabilir'],
      ['Menünün kapatılması', 'Düşük', 'Veri korunur, yalnız erişim gizlenir'],
      ['Permission geri alınması', 'Düşük', 'Erişim kapanır, veri etkilenmez'],
      ['Belge entity eşlemesinin geri alınması', 'Orta', 'Kanıt erişimi kopabilir; storage anahtarlarının korunması gerekir'],
    ],
    [32, 14, 54],
  ),
);

content.push(title('9. Production Deploy Öncesi Onay Kapısı'));
content.push(
  subtitle('Canlı öncesi istenecek kanıtlar'),
  bullet('Local ortam ekran görüntüleri: 4 sekme, test note oluşturma, work item durumu, danışman formatı, export ekranı'),
  bullet('Staging doğrulaması: admin erişimi, non-admin engeli, export dosyası, kanıt yükleme akışı'),
  bullet('Teknik doğrulama: migration listesi, etkilenen dosya listesi, rollback notu, smoke test sonuçları'),
  bullet('Ürün doğrulama: PASS tanımının kullanıcı beklentisi + ekran davranışı ile karşılandığına dair örnek akış'),
  subtitle('Açık onay metni template’i'),
  makeTable(
    [
      ['Başlık', 'Şablon'],
      ['Onay metni', '“Test Notları ve Görev Takip Modülü için local/staging doğrulamaları, yetki testleri, export kontrolleri ve rollback hazırlığı tamamlanmıştır. Aşağıdaki kanıtlar incelenmiş olup production deploy için açık onay talep edilmektedir. Bu onay verilmeden canlıya çıkılmayacaktır.”'],
      ['Eklenecek ekler', 'Ekran görüntüleri, export örneği, yetki testi sonucu, smoke test listesi, migration listesi'],
    ],
    [20, 80],
  ),
  subtitle('Smoke test senaryoları'),
  bullet('Admin giriş yapar, sayfayı açar, sekmeler arası geçiş yapar.'),
  bullet('Yeni test notu açılır, listede görünür, durumu güncellenir.'),
  bullet('Test notundan danışman formatı önerisi üretilir.'),
  bullet('İş/Karar kaydı oluşturulur ve tamamlandı durumuna alınır.'),
  bullet('Excel export alınır ve üç ana sheet doğrulanır.'),
  bullet('Admin olmayan kullanıcı erişim denemesinde başarısız olur.'),
);

content.push(title('10. Tahmini Etki'));
content.push(
  subtitle('Değişecek dosyalar'),
  makeTable(
    [
      ['Tür', 'Dosyalar / klasörler'],
      ['Mevcut dosyalar', 'apps/web/src/app/panel/layout.tsx; apps/web/src/utils/screen-permissions.ts; apps/backend/src/modules/users/screen-permissions.defaults.ts; apps/backend/prisma/schema.prisma; apps/backend/src/app.module.ts; gerekirse apps/backend/src/common/guards/permissions.guard.ts'],
      ['Yeni frontend dosyaları', 'apps/web/src/app/panel/ayarlar/test-notlari-gorev-takip/page.tsx ve ilişkili component/type/service dosyaları'],
      ['Yeni backend dosyaları', 'apps/backend/src/modules/test-notes-work-items/* altında module/controller/service/dto/export builder dosyaları'],
      ['Yeni migration/seed dosyaları', 'apps/backend/prisma/migrations/* ve ilgili seed genişletmeleri'],
    ],
    [22, 78],
  ),
  subtitle('Risk seviyesi'),
  bullet('Genel risk: Orta'),
  bullet('Sebep: yeni tablo, yetki, dosya upload ve export alanları birden çok katmana temas ediyor.'),
  bullet('Yüksek riskli alt alanlar: permission yanlış yapılandırması, belge entity entegrasyonu, export veri bütünlüğü.'),
  subtitle('Tahmini süre'),
  makeTable(
    [
      ['İş paketi', 'Tahmini süre'],
      ['Backend model + DTO + CRUD + export', '1.5 - 2.5 gün'],
      ['Frontend sayfa + 4 sekme + durum/filtre akışları', '2 - 3 gün'],
      ['Yetki + menü + screen permission uyarlamaları', '0.5 gün'],
      ['Kanıt yükleme entegrasyonu', '0.5 - 1 gün'],
      ['Local/staging doğrulama + raporlama', '0.5 - 1 gün'],
      ['Toplam kontrollü uygulama', 'Yaklaşık 5 - 8 iş günü'],
    ],
    [42, 58],
  ),
  subtitle('Bağımlılıklar'),
  bullet('Mevcut upload/file document altyapısı'),
  bullet('Prisma migration akışı ve seed mekanizması'),
  bullet('Frontend panel layout ve screen permission mantığı'),
  bullet('Backend permission guard ve JWT kullanıcı yükleme akışı'),
  bullet('ExcelJS tabanlı export yaklaşımı'),
  subtitle('Mevcut koda temas noktaları'),
  bullet('Frontend: panel layout, ayarlar menüsü, screen permission listeleri, admin route yapısı'),
  bullet('Backend: app module registration, yeni modül klasörü, Prisma şeması, export builder, guard/decorator kullanımı'),
  bullet('Ürün düzeyi: geçici sayfa kuralları, PASS tanımı, canlı öncesi local doğrulama zorunluluğu'),
);

content.push(
  new Paragraph({ children: [new PageBreak()] }),
  title('Karar ve Gerekçe Özeti'),
  bullet('Yeni modül için bağımsız backend klasörü planlandı; mevcut `tasks` modülünü doğrudan genişletmek reddedildi, çünkü kullanıcı talebi geçici/admin-only bir alan ve ileride kaldırılabilir yapı istiyor.'),
  bullet('Screen code yaklaşımı mevcut `ayarlar` genel kodu altında bırakılmak yerine ayrı kod olarak planlandı; çünkü route bazlı görünürlük ve geçici modül takibi daha net olur.'),
  bullet('Kanıt yönetiminde yalnız tablo içi string path tutulması yerine mevcut upload/document altyapısına dayanmak tercih edildi; proje geneli belge yönetimiyle uyum bu tarafta daha yüksek.'),
  bullet('Excel export’te yeni kütüphane önerilmedi; `apps/backend/src/modules/dashboard/export.service.ts` içindeki yerleşik desen mevcut ihtiyacı karşılıyor.'),
  paragraph(
    [
      text('Not: ', { bold: true, color: theme.danger }),
      text(
        'Bu belge yalnız kontrollü uygulama planıdır. Kod geliştirme, migration oluşturma ve production deploy bu çalışma kapsamında yapılmamıştır.',
      ),
    ],
    { spacing: { before: 120, after: 120 } },
  ),
);

const doc = new Document({
  creator: 'Verdent',
  title: 'Test Notları Modülü Kontrollü Uygulama Planı',
  description: 'Sigorta Hasar Sistemi için kod yazmadan hazırlanmış kontrollü uygulama planı',
  numbering: {
    config: [
      {
        reference: 'main-numbering',
        levels: [
          {
            level: 0,
            format: 'decimal',
            text: '%1.',
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          },
        ],
      },
    ],
  },
  sections: [
    {
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [new TextRun({ text: 'Test Notları ve Görev Takip Modülü — Kontrollü Uygulama Planı', color: theme.muted, size: 18 })],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: '22.05.2026 | Kod/migration/deploy yapılmadı', color: theme.muted, size: 18 })],
            }),
          ],
        }),
      },
      children: content,
    },
  ],
});

Packer.toBuffer(doc)
  .then((buffer) => {
    fs.writeFileSync(outputPath, buffer);
    process.stdout.write(outputPath);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });