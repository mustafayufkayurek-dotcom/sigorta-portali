/**
 * Saha tespitçisi görünürlük kilidi (kaynak tarama — tsx path alias gerekmez).
 * Çalıştır: node --experimental-strip-types --test src/utils/field-staff-claim-view.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(join(here, rel), 'utf8');

describe('field-staff-claim-view lock', () => {
  it('sözleşme dosyası sigortalı/adres/telefon + gizli sekmeleri tanımlar', () => {
    const util = read('./field-staff-claim-view.ts');
    assert.match(util, /fieldStaffInsuredName/);
    assert.match(util, /fieldStaffPhone/);
    assert.match(util, /fieldStaffAddress/);
    assert.match(util, /fieldStaffDirectionsUrl/);
    assert.match(util, /fieldStaffInspectionStatus/);
    assert.match(util, /fieldStaffInspectionBadgeClass/);
    assert.match(util, /fieldStaffInspectionReminder/);
    assert.match(util, /inspectionReminder/);
    assert.match(util, /tespit henüz yapılmadı/);
    assert.match(util, /Tespit Yapıldı/);
    assert.match(util, /Tespit Yapılmadı/);
    assert.match(util, /tespit bekleniyor/);
    assert.match(util, /fieldStaffAssignedListSplit/);
    assert.match(util, /FIELD_STAFF_COMPLETED_INSPECTIONS_HREF/);
    assert.match(util, /FIELD_STAFF_COMPLETED_INSPECTIONS_LABEL/);
    assert.match(util, /FIELD_STAFF_ASSIGNMENTS_HREF/);
    assert.match(util, /FIELD_STAFF_ASSIGNMENTS_LABEL/);
    assert.match(util, /FIELD_STAFF_CLAIMS_CHANGED_EVENT/);
    assert.match(util, /notifyFieldStaffClaimsChanged/);
    assert.match(util, /Tamamlanan Tespitler/);
    assert.match(util, /Atanan Dosyalar/);
    assert.match(util, /fieldStaffCompletedInspectionFiles/);
    assert.match(util, /OFFICE_COMPLETED_INSPECTIONS_HREF/);
    assert.match(util, /OFFICE_COMPLETED_INSPECTIONS_LABEL/);
    assert.match(util, /Tespiti Tamamlanan/);
    assert.match(util, /status=open/);
    assert.doesNotMatch(util, /FIELD_STAFF_PENDING_INSPECTIONS/);
    assert.doesNotMatch(util, /fieldStaffPendingInspectionFiles/);
    assert.match(util, /FIELD_STAFF_HIDDEN_CLAIM_TABS/);
    assert.match(util, /'finans'/);
    assert.match(util, /'operasyon'/);
    assert.match(util, /'raporlar'/);
    assert.match(util, /'genel-bilgiler'/);
    assert.doesNotMatch(util, /'evraklar'/);
  });

  it('liste saha kartında finans/tedarikçi göstermez; tespit durumu gösterir', () => {
    const list = read('../app/panel/hasar-dosyalari/page.tsx');
    assert.match(list, /field-staff-claim-view/);
    assert.match(list, /fieldStaffInsuredName/);
    assert.match(list, /fieldStaffPhone/);
    assert.match(list, /fieldStaffAddress/);
    assert.match(list, /fieldStaffInspectionStatus/);
    assert.match(list, /FieldInsuredContactActions/);
    assert.match(list, /if \(isFieldStaff\)/);
    assert.match(list, /Atanan Dosyalar/);
    assert.match(list, /FIELD_STAFF_COMPLETED_INSPECTIONS_HREF/);
    assert.match(list, /Tamamlanan Tespitler/);
    assert.match(list, /Tespit Fotoğrafları/);
    assert.match(list, /Dosyaya Git/);
    assert.match(list, /saha-tespit-rozet/);
    assert.doesNotMatch(list, /ofis-tespit-rozet/);
    assert.doesNotMatch(list, /officeCompletedFilter/);
    assert.doesNotMatch(list, /saha-tespit-filtre/);
    const fieldCardStart = list.indexOf('data-testid="saha-dosya-karti"');
    assert.ok(fieldCardStart >= 0);
    const fieldCard = list.slice(fieldCardStart, fieldCardStart + 1800);
    assert.doesNotMatch(fieldCard, /resolveClaimSupplierDisplayName/);
    assert.doesNotMatch(fieldCard, /invoicedAmount/);
  });

  it('saha Ara/WhatsApp contact-events ile dosyaya kayıt yazar', () => {
    const actions = read('../components/field-survey/FieldInsuredContactActions.tsx');
    assert.match(actions, /claim-operation-center\/\$\{body\.claimId\}\/contact-events/);
    assert.match(actions, /logAnd\('phone'/);
    assert.match(actions, /logAnd\('whatsapp'/);
    assert.match(actions, /saha-telefon-ara/);
    assert.match(actions, /saha-whatsapp-gonder/);
    const history = read('../components/field-survey/FieldContactHistory.tsx');
    assert.match(history, /PHONE_CALL_RECORDED/);
    assert.match(history, /WHATSAPP_STATUS_RECORDED/);
    assert.match(history, /İletişim Kayıtları/);
    const msg = read('./field-insured-whatsapp-message.ts');
    assert.match(msg, /buildFieldInsuredWhatsAppMessage/);
    assert.match(msg, /Dosya No:/);
  });

  it('Saha Merkezi özeti Atanan Dosyalar ve Tamamlanan Tespitler sayfalarına gider', () => {
    const home = read('../features/dashboard/components/admin/field-operations-home.tsx');
    assert.match(home, /saha-tespit-hatirlatma/);
    assert.match(home, /InspectionReminderBanner/);
    assert.match(home, /fieldStaffInspectionReminder/);
    assert.match(home, /FIELD_STAFF_ASSIGNMENTS_HREF/);
    assert.match(home, /FIELD_STAFF_ASSIGNMENTS_LABEL/);
    assert.match(home, /FIELD_STAFF_COMPLETED_INSPECTIONS_LABEL/);
    assert.match(home, /FIELD_STAFF_COMPLETED_INSPECTIONS_HREF/);
    assert.match(home, /saha-kpi-atanan-dosyalar/);
    assert.match(home, /saha-kpi-tespiti-tamamlananlar/);
    assert.doesNotMatch(home, /filter === 'completed'/);
    assert.doesNotMatch(home, /setFilter/);
    assert.doesNotMatch(home, /Bekleyen Görevler/);
    assert.doesNotMatch(home, /Bana Atanan/);
    assert.doesNotMatch(home, /Bekleyen Tespit Dosyaları/);
    assert.match(home, /FieldInsuredContactActions/);
    assert.match(home, /fieldStaffPhone/);
    assert.match(home, /fieldStaffInspectionStatus/);
    assert.match(home, /Sigortalı/);
    assert.match(home, /from-brand-50/);
    assert.match(home, /compact/);
    assert.match(home, /saha-merkez-dosya-karti/);
    assert.match(home, /saha-merkez-tamamlanan-kart/);
    assert.match(home, /saha-merkez-yaklasan-kart/);
    assert.doesNotMatch(home, /Benden İstenenler/);
    const panel = read('../app/panel/page.tsx');
    assert.match(panel, /Saha Merkezi/);
    assert.match(panel, /Atanan Dosyalar ve Tamamlanan Tespitler/);
    const header = read('../app/panel/_components/dashboard-header.tsx');
    assert.doesNotMatch(header, /Dosyalarıma Git/);
    const banner = read('../components/field-survey/InspectionReminderBanner.tsx');
    assert.match(banner, /Dosyalarıma Git/);
  });

  it('ofis + saha aynı tespit uyarı bandı yöntemi; çan/WhatsApp kanalı yok', () => {
    const banner = read('../components/field-survey/InspectionReminderBanner.tsx');
    assert.match(banner, /InspectionReminderBanner/);
    assert.match(banner, /amber-50/);
    assert.doesNotMatch(banner, /\/notifications/);
    assert.doesNotMatch(banner, /openWhatsAppChat/);

    const office = read('../features/dashboard/components/admin/office-inspection-reminder.tsx');
    assert.match(office, /OfficeInspectionReminder/);
    assert.match(office, /InspectionReminderBanner/);
    assert.match(office, /inspectionReminder/);
    assert.match(office, /'office'/);
    assert.match(office, /assignedOfficeUserId/);
    assert.match(office, /statusCode: 'open'/);
    assert.match(office, /ofis-tespit-hatirlatma/);
    assert.match(office, /ofis-tespiti-tamamlanan/);
    assert.match(office, /OFFICE_COMPLETED_INSPECTIONS_HREF/);
    assert.match(office, /OFFICE_COMPLETED_INSPECTIONS_LABEL/);
    assert.match(office, /Hasar Dosyaları/);
    assert.match(office, /fieldStaffCompletedInspectionFiles/);
    assert.doesNotMatch(office, /\/panel\/saha\/tespiti-tamamlananlar/);
    assert.doesNotMatch(office, /\/notifications/);
    assert.doesNotMatch(office, /openWhatsAppChat/);
    assert.doesNotMatch(office, /PendingOperations/);

    const panel = read('../app/panel/page.tsx');
    assert.match(panel, /OfficeInspectionReminder/);
    const officeStart = panel.indexOf('if (showOfficeLayout) {');
    const fieldStart = panel.indexOf('/** Saha Personeli ana sayfa');
    assert.ok(officeStart >= 0 && fieldStart > officeStart);
    const officeBlock = panel.slice(officeStart, fieldStart);
    assert.match(officeBlock, /OfficeInspectionReminder/);
    assert.doesNotMatch(officeBlock, /FieldOperationsHome/);
  });

  it('detay saha ziyaret kartı + tespit foto/not + işaretleme; ofis sekmeleri yok', () => {
    const detail = read('../app/panel/hasar-dosyalari/[id]/page.tsx');
    assert.match(detail, /Saha Tespit/);
    assert.match(detail, /import \{ DelegationBanner \}/);
    assert.match(detail, /<DelegationBanner/);
    assert.match(detail, /fieldStaffDirectionsUrl/);
    assert.match(detail, /fieldStaffInspectionStatus/);
    assert.match(detail, /FieldInsuredContactActions/);
    assert.match(detail, /FieldContactHistory/);
    assert.match(detail, /FieldInspectionPhotosPanel/);
    assert.match(detail, /Yol Tarifi/);
    assert.match(detail, /Tespit Yapıldı Olarak İşaretle/);
    assert.match(detail, /\/inspection/);
    assert.match(detail, /Tespit Fotoğrafları/);
    assert.match(detail, /Tespit Notları/);
    assert.match(detail, /IletisimGunluguPanel/);
    assert.match(detail, /variant="field"/);
    const notes = read('../app/panel/hasar-dosyalari/[id]/_components/tabs/IletisimGunluguPanel.tsx');
    assert.match(notes, /tespit-notu-duzenle/);
    assert.match(notes, /Düzenle/);
    assert.doesNotMatch(notes, /tespit-notu-duzeltme/);
    assert.doesNotMatch(notes, />Düzeltme</);
    assert.doesNotMatch(notes, /type="checkbox"/);
    assert.doesNotMatch(notes, /Henüz Tespit Notu Yok/);
    assert.match(detail, /\{!isFieldStaff && \(/);
    assert.match(detail, /FIELD_STAFF_HIDDEN_CLAIM_TABS/);
    assert.match(detail, /office-inspection-reminder/);
    assert.match(detail, /ofis-saha-tespit/);
    // Ofis evrak yaşam döngüsü saha bloğunda olmamalı
    const fieldBlock = detail.slice(
      detail.indexOf('{/* Saha: ziyaret + foto + not'),
      detail.indexOf('{!isFieldStaff && (', detail.indexOf('{/* Saha: ziyaret + foto + not')),
    );
    assert.match(fieldBlock, /lg:grid-cols-2/);
    assert.doesNotMatch(fieldBlock, /EvraklarTab/);
    assert.doesNotMatch(fieldBlock, /EvrakOzetPanel/);
    assert.doesNotMatch(fieldBlock, /Dosya Yaşam Döngüsü/);
    assert.doesNotMatch(fieldBlock, /Sözleşmeler/);
    const officeBlock = detail.slice(detail.indexOf('{!isFieldStaff && ('));
    assert.match(officeBlock, /ofis-saha-tespit/);
    const officeSaha = officeBlock.slice(
      officeBlock.indexOf('data-testid="ofis-saha-tespit"'),
      officeBlock.indexOf("canViewFinancials && activeGroup !== 'finans'"),
    );
    assert.doesNotMatch(officeSaha, /FieldInspectionPhotosPanel/);
    assert.doesNotMatch(officeSaha, /IletisimGunluguPanel/);
    const raporlar = officeBlock.slice(
      officeBlock.indexOf("activeGroup === 'raporlar'"),
      officeBlock.indexOf("activeGroup === 'evraklar'"),
    );
    assert.match(raporlar, /RaporlarTespitBlok/);
    assert.match(raporlar, /OnarimRaporuTab/);
    const tespitBlok = read('../app/panel/hasar-dosyalari/[id]/_components/tabs/RaporlarTespitBlok.tsx');
    assert.match(tespitBlok, /RaporlarJumpStrip/);
    assert.match(tespitBlok, /Tespit Resimleri/);
    assert.match(tespitBlok, /raporlar-atlama-tespit-resimleri/);
    assert.match(tespitBlok, /FieldInspectionPhotosPanel/);
    assert.match(tespitBlok, /IletisimGunluguPanel/);
    assert.match(tespitBlok, /Tespit Notları/);
    assert.doesNotMatch(tespitBlok, /Tespit resimlerini incele/);
    assert.doesNotMatch(tespitBlok, /tespit-resimlerini-incele/);
    assert.match(tespitBlok, /icon=\{ImagePlus\}/);
    assert.match(tespitBlok, /SmartMeasureList/);
    const onarimTab = read('../app/panel/hasar-dosyalari/[id]/_components/tabs/OnarimRaporuTab.tsx');
    assert.match(onarimTab, /raporlar-onarim/);
    assert.match(onarimTab, /raporlar-revizyon/);
    assert.match(onarimTab, /max-h-\[min\(32rem,55vh\)\]/);
    const reportPage = read('../app/panel/hasar-dosyalari/[id]/onarim-raporu/[reportId]/page.tsx');
    assert.match(reportPage, /bg-slate-50 px-5 py-3/);
    assert.doesNotMatch(officeBlock, /Tespit Yapıldı Olarak İşaretle/);
    assert.doesNotMatch(officeBlock, /FIELD_STAFF_COMPLETED_INSPECTIONS_HREF/);
  });

  it('saha tespit foto paneli entity-documents kullanır; yaşam döngüsü yok', () => {
    const photos = read('../components/field-survey/FieldInspectionPhotosPanel.tsx');
    assert.match(photos, /entityType = 'claim_file'/);
    assert.match(photos, /entityType/);
    assert.match(photos, /entity-documents\/\$\{id\}\/file|entityDocumentFileUrl/);
    assert.match(photos, /AuthBlobImg|createObjectURL/);
    assert.match(photos, /h-36 w-36/);
    assert.match(photos, /PhotoLightbox|Önceki/);
    assert.match(photos, /Tespit Fotoğrafı/);
    assert.match(photos, /saha-tespit-fotograflari/);
    assert.match(photos, /capture="environment"/);
    assert.match(photos, /Kameradan/);
    assert.match(photos, /Galeriden/);
    assert.match(photos, /sürükleyip bırakarak/);
    assert.match(photos, /onDrop=\{onDropFiles\}/);
    assert.doesNotMatch(photos, /muvafakat/);
    assert.doesNotMatch(photos, /Yaşam Döngüsü/);
  });

  it('Tamamlanan Tespitler sayfası tespit bitenleri toplar', () => {
    const page = read('../app/panel/saha/tespiti-tamamlananlar/page.tsx');
    const view = read('../features/dashboard/components/admin/field-completed-inspections-page.tsx');
    assert.match(page, /FieldCompletedInspectionsPage/);
    assert.match(view, /Tamamlanan Tespitler/);
    assert.match(view, /FIELD_STAFF_ASSIGNMENTS_HREF/);
    assert.match(view, /FIELD_STAFF_ASSIGNMENTS_LABEL/);
    assert.match(view, /fieldStaffCompletedInspectionFiles/);
    assert.match(view, /saha-tespiti-tamamlananlar/);
    assert.match(view, /saha-tamamlanan-tespit-ara/);
    assert.match(view, /SearchInput/);
    assert.match(view, /sm:w-\[17rem\]/);
    assert.match(view, /filter-bar/);
    assert.doesNotMatch(view, /size="lg"/);
    assert.doesNotMatch(view, /basis-full/);
    assert.match(view, /statusCode: includeClosed \? 'closed' : 'open'/);
    const layout = read('../app/panel/layout.tsx');
    assert.match(layout, /FIELD_STAFF_ASSIGNMENTS_LABEL/);
    assert.match(layout, /FIELD_STAFF_COMPLETED_INSPECTIONS_HREF/);
    assert.match(layout, /FIELD_STAFF_CLAIMS_CHANGED_EVENT/);
    assert.match(layout, /alertCount: fieldAssignedCount/);
    assert.match(layout, /useFieldAssignedNavCount/);
    assert.doesNotMatch(layout, /Bekleyen Tespitler/);
    const officeNav = layout.slice(layout.indexOf(': isOfficeStaff'), layout.indexOf(': isFieldStaff'));
    assert.match(officeNav, /Dosya Merkezi/);
    assert.doesNotMatch(officeNav, /Tamamlanan Tespitler/);
    assert.doesNotMatch(officeNav, /FIELD_STAFF_COMPLETED_INSPECTIONS/);
    const rules = read('./panel-route-access.rules.json');
    assert.match(rules, /\/panel\/saha\/bekleyen-tespitler/);
    const redirect = read('../app/panel/saha/bekleyen-tespitler/page.tsx');
    assert.match(redirect, /FIELD_STAFF_ASSIGNMENTS_HREF/);
    assert.match(redirect, /router\.replace/);
  });

  it('tespit tamamla ve dosya kapat onay ister', () => {
    const detail = read('../app/panel/hasar-dosyalari/[id]/page.tsx');
    assert.match(detail, /window\.confirm/);
    assert.match(detail, /saha-dosya-kapat/);
    assert.match(detail, /field-close/);
    assert.match(detail, /notifyFieldStaffClaimsChanged/);
    assert.match(detail, /FIELD_STAFF_COMPLETED_INSPECTIONS_HREF/);
    assert.match(detail, /FIELD_STAFF_ASSIGNMENTS_HREF/);
  });
});
