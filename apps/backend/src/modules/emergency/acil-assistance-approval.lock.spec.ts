/**
 * Çilingir dışı Acil: Hasar benzeri rapor PDF, İhbar kutusu, gelen kutu kararı.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/modules/emergency/acil-assistance-approval.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const svc = readFileSync(join(here, 'emergency-cases.service.ts'), 'utf8');
const html = readFileSync(join(here, 'acil-approval-report-html.ts'), 'utf8');
const ctrl = readFileSync(join(here, 'emergency-cases.controller.ts'), 'utf8');
const inbox = readFileSync(join(here, '../operation-inbox/operation-inbox.service.ts'), 'utf8');

describe('acil asistans rapor onay LOCK', () => {
  it('Çilingir bu yola girmez; rapor İhbar kutusundan PDF gider', () => {
    assert.match(svc, /isAcilLocksmithIssue/);
    assert.match(svc, /Çilingir dosyasında bu rapor yolu yoktur/);
    const send = svc.slice(svc.indexOf('async sendAssistanceApprovalReport'));
    assert.match(send, /mailbox:\s*'IHBAR'/);
    assert.match(send, /buildAssistanceApprovalPdf\(caseId, 'send'\)/);
    assert.match(svc, /htmlDocumentToPdf/);
    assert.match(send, /acil-rapor-DIS-/);
    assert.doesNotMatch(send, /entryType === 'gider'/);
    assert.match(html, /Tespit Resimleri/);
    assert.match(html, /photo-gallery/);
    assert.match(html, /packAcilReportPhotoRows/);
    assert.match(html, /signature-section/);
    assert.match(html, /Dijital Onaylı/);
    assert.match(html, /closing-block-next/);
    assert.match(html, /legal-closing/);
    assert.doesNotMatch(html, /info-identity/);
    assert.match(svc, /embedOrientedAcilReportPhoto/);
    assert.match(html, /Acil Yardım Tespit Raporu/);
    assert.match(html, /info-id-grid/);
    assert.match(html, /findings-box/);
    assert.match(html, /findings-lead/);
    assert.match(html, /items-table/);
    assert.match(html, /repair-total-band/);
    assert.match(html, /header-usage-external/);
    assert.match(html, /Dış Kullanım/);
    assert.match(html, /report-footer/);
    assert.match(html, /Tespiti Yapan/);
    assert.match(html, /Raporlayan/);
    assert.match(html, /Sicil No/);
    assert.match(html, /formatAcilCityNetwork/);
    assert.match(html, / Network/);
    assert.match(html, /İşlem Öncesi Dijital Onaylar/);
    assert.match(html, /İzinsiz çoğaltılamaz ve dağıtılamaz/);
    assert.match(html, /formatAcilAmountVat/);
    assert.match(html, /\}\+KDV/);
    assert.match(svc, /TL\+KDV/);
    assert.match(html, /reporter-sicil/);
    assert.match(svc, /hrEmployeeProfile/);
    assert.match(svc, /personnelNo/);
    assert.match(svc, /employeeCode/);
    assert.match(svc, /ACIL_ADRES_HIZMET_TALEP_KIND/);
    assert.match(html, /Safran Birleşik Hizmetler/);
    assert.doesNotMatch(html, /class="meta"/);
    assert.match(ctrl, /approval-email/);
    assert.match(ctrl, /approval-report/);
    assert.match(ctrl, /res\.send\(pdf\)/);
    assert.doesNotMatch(ctrl, /text\/html/);
    assert.match(ctrl, /report-line-phrases/);
    assert.match(html, /input\.workGroup/);
    assert.match(html, /input\.jobDescription/);
    assert.match(html, />Maktuen</);
    assert.doesNotMatch(html, /<td class="text-center">Hizmet<\/td>/);
    assert.doesNotMatch(ctrl, /res\.redirect\(302\)/);
    assert.match(svc, /previewAssistanceApprovalReport/);
  });

  it('kapanış PDF tespit kabuğunu kullanır; Çilingir dahil İhbar kutusundan gider', () => {
    assert.match(html, /kind === 'kapanis'/);
    assert.match(html, /Acil Yardım Dosya Kapanış Raporu/);
    assert.match(html, /Hizmet Sonrası Resimleri/);
    assert.match(html, /Hizmet Özeti/);
    assert.match(html, /dosyasının kapanışı üzerine/);
    assert.match(html, /SLA Süresi/);
    assert.match(html, /header-closed-stamp/);
    assert.match(html, /Dosya Kapanmıştır/);
    assert.match(html, /Hizmet Bitiş/);
    assert.doesNotMatch(html, /İhbar Tarihi \$\{/);
    const closure = svc.slice(svc.indexOf('private async buildClosureEmailPayload'));
    assert.match(closure, /buildAcilAssistanceApprovalReportHtml/);
    assert.match(closure, /kind:\s*'kapanis'/);
    assert.match(closure, /embedAcilCasePhotos/);
    assert.doesNotMatch(closure.slice(0, 3500), /isAcilLocksmithIssue/);
    const send = svc.slice(svc.indexOf('async sendClosureEmail('));
    assert.match(send, /mailbox:\s*'IHBAR'/);
    assert.doesNotMatch(send.slice(0, 1200), /isAcilLocksmithIssue/);
    assert.match(svc, /formatAcilSlaDuration/);
    const ascii = readFileSync(join(here, 'acil-closure-report-pdf.ts'), 'utf8');
    assert.match(ascii, /SLA suresi/);
    assert.match(ascii, /Dosya Kapanmistir/);
  });

  it('manuel onay red revize sil dosyada tarihçeye düşer', () => {
    const proc = readFileSync(join(here, 'emergency-process-events.ts'), 'utf8');
    assert.match(proc, /EMERGENCY_REPORT_REVISED/);
    assert.match(proc, /EMERGENCY_REPORT_DELETED/);
    const singleton = proc.slice(proc.indexOf('EMERGENCY_PROCESS_SINGLETON_ACTIONS'), proc.indexOf('MESSAGE_DEDUPE_MS'));
    assert.doesNotMatch(singleton, /EMERGENCY_CUSTOMER_APPROVED/);
    assert.doesNotMatch(singleton, /EMERGENCY_CUSTOMER_REJECTED/);
    assert.match(svc, /metadata\.actorName = actorName/);
    const manual = svc.slice(svc.indexOf('async recordManualDecision'));
    assert.match(manual, /actorName/);
    assert.match(manual, /Manuel onay/);
    assert.match(manual, /EMERGENCY_REPORT_REVISED/);
  });

  it('gelen kutu kararı çilingirde durmaz; dosya sorumlusuna ekran ve mail', () => {
    assert.match(inbox, /applyInboundAssistanceDecision/);
    assert.match(svc, /parseAssistanceMailDecision/);
    assert.match(svc, /relatedEntityType: 'emergency_case'/);
    assert.match(svc, /type: 'emergency_assistance_decision'/);
    const apply = svc.slice(svc.indexOf('async applyInboundAssistanceDecision'));
    assert.match(apply, /mailbox:\s*'IHBAR'/);
  });
});
