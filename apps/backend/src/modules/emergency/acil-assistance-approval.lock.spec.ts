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
    assert.match(html, /Acil Yardım Tespit Raporu/);
    assert.match(html, /info-id-grid/);
    assert.match(html, /findings-box/);
    assert.match(html, /findings-lead/);
    assert.match(html, /items-table/);
    assert.match(html, /repair-total-band/);
    assert.match(html, /header-usage-external/);
    assert.match(html, /Dış Kullanım/);
    assert.match(html, /report-footer/);
    assert.match(html, /Safran Birleşik Hizmetler/);
    assert.doesNotMatch(html, /class="meta"/);
    assert.match(ctrl, /approval-email/);
    assert.match(ctrl, /approval-report/);
    assert.match(ctrl, /res\.send\(pdf\)/);
    assert.doesNotMatch(ctrl, /text\/html/);
    assert.match(ctrl, /report-line-phrases/);
    assert.match(html, /input\.workGroup/);
    assert.match(html, /input\.jobDescription/);
    assert.doesNotMatch(ctrl, /res\.redirect\(302\)/);
    assert.match(svc, /previewAssistanceApprovalReport/);
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
