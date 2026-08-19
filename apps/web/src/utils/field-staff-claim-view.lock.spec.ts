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
    assert.match(util, /Tamamlanan Tespitler/);
    assert.match(util, /Atanan Dosyalar/);
    assert.match(util, /fieldStaffCompletedInspectionFiles/);
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
    assert.match(list, /Tamamlanan Tespitler/);
    assert.match(list, /Tespit Fotoğrafları/);
    assert.match(list, /Dosyaya Git/);
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
    assert.match(detail, /\{!isFieldStaff && \(/);
    assert.match(detail, /FIELD_STAFF_HIDDEN_CLAIM_TABS/);
    // Ofis evrak yaşam döngüsü saha bloğunda olmamalı
    const fieldBlock = detail.slice(
      detail.indexOf('{isFieldStaff && ('),
      detail.indexOf('{!isFieldStaff && ('),
    );
    assert.doesNotMatch(fieldBlock, /EvraklarTab/);
    assert.doesNotMatch(fieldBlock, /EvrakOzetPanel/);
    assert.doesNotMatch(fieldBlock, /Dosya Yaşam Döngüsü/);
    assert.doesNotMatch(fieldBlock, /Sözleşmeler/);
  });

  it('saha tespit foto paneli entity-documents kullanır; yaşam döngüsü yok', () => {
    const photos = read('../components/field-survey/FieldInspectionPhotosPanel.tsx');
    assert.match(photos, /entityType: 'claim_file'/);
    assert.match(photos, /Tespit Fotoğrafı/);
    assert.match(photos, /saha-tespit-fotograflari/);
    assert.match(photos, /capture="environment"/);
    assert.match(photos, /Kameradan/);
    assert.match(photos, /Galeriden/);
    assert.doesNotMatch(photos, /muvafakat/);
    assert.doesNotMatch(photos, /Yaşam Döngüsü/);
  });

  it('Tamamlanan Tespitler sayfası tespit bitenleri toplar', () => {
    const page = read('../app/panel/saha/tespiti-tamamlananlar/page.tsx');
    const view = read('../features/dashboard/components/admin/field-completed-inspections-page.tsx');
    assert.match(page, /FieldCompletedInspectionsPage/);
    assert.match(view, /Tamamlanan Tespitler/);
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
    assert.match(layout, /Tamamlanan Tespitler/);
    assert.match(layout, /title: 'Atanan Dosyalar'/);
    assert.match(layout, /\/panel\/saha\/tespiti-tamamlananlar/);
    assert.match(layout, /alertCount: fieldAssignedCount/);
    assert.match(layout, /useFieldAssignedNavCount/);
    assert.doesNotMatch(layout, /Bekleyen Tespitler/);
    assert.doesNotMatch(layout, /bekleyen-tespitler/);
    const rules = read('./panel-route-access.rules.json');
    assert.doesNotMatch(rules, /bekleyen-tespitler/);
  });

  it('tespit tamamla ve dosya kapat onay ister', () => {
    const detail = read('../app/panel/hasar-dosyalari/[id]/page.tsx');
    assert.match(detail, /window\.confirm/);
    assert.match(detail, /saha-dosya-kapat/);
    assert.match(detail, /field-close/);
  });
});
