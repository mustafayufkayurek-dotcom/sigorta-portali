/**
 * Kilit: müşteri/eksper/dış onay ekinde yalnız dış PDF (DIS).
 * İç PDF yalnız yönetici onay mailine; müşteriye gitmez.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/modules/repair-reports/report-mail-external-pdf.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

describe('rapor mail eki dış PDF LOCK', () => {
  it('sendReport yalnız DIS dosya adı üretir; iç PDF reddedilir', () => {
    const src = readFileSync(join(here, 'email/report-email.service.ts'), 'utf8');
    assert.match(src, /hasar-raporu-DIS-/);
    assert.match(src, /E-posta ekinde yalnız dış kullanım raporu gider/);
    assert.doesNotMatch(src, /hasar-raporu-IC-/);
    assert.doesNotMatch(src, /internal \? 'IC'/);
  });

  it('send-email ve onaya gönderim dış PDF üretir', () => {
    const src = readFileSync(join(here, 'repair-reports.service.ts'), 'utf8');
    assert.match(src, /generatePdf\(reportId, 'external', fit\)/);
    assert.match(src, /const pdfBuffer = await this\.externalMailPdf\(reportId\)/);
    assert.match(src, /const customerPdf = await this\.externalMailPdf\(reportId\)/);
    assert.doesNotMatch(src, /generatePdf\(reportId, dto\.viewType\)/);
    assert.match(src, /viewType: 'external'/);
    assert.match(src, /pdfBuffer: customerPdf/);
    assert.doesNotMatch(src, /pdfBuffer: internalPdf/);
  });

  it('yönetici onay mailine iç PDF ekler; müşteri sendReport iç PDF almaz', () => {
    const src = readFileSync(join(here, 'repair-reports.service.ts'), 'utf8');
    assert.match(src, /generatePdf\(reportId, 'internal'\)/);
    assert.match(src, /internalRepairPdfFilename/);
    assert.match(src, /onManagerApprovalRequested/);
    const emailSrc = readFileSync(join(here, 'email/report-email.service.ts'), 'utf8');
    assert.doesNotMatch(emailSrc, /hasar-raporu-IC-/);
    const managerSrc = readFileSync(
      join(here, '../notifications/email/claim-event-email.service.ts'),
      'utf8',
    );
    assert.match(managerSrc, /filterRepairReportMailAttachments/);
    assert.match(managerSrc, /İç rapor PDF ve resimler ekte/);
  });

  it('dış onay maili dış PDF ekler', () => {
    const src = readFileSync(join(here, '../external-approvals/external-approvals.service.ts'), 'utf8');
    assert.match(src, /generate\(pdfReport as any, 'external'\)/);
    assert.match(src, /hasar-raporu-DIS-/);
    assert.doesNotMatch(src, /hasar-raporu-IC-/);
  });
});
