/**
 * Kilit: giden hasar raporu ekinde yalnız dış PDF (DIS). İç / maliyet PDF yok.
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
    assert.match(src, /generatePdf\(reportId, 'external'\)/);
    assert.doesNotMatch(src, /generatePdf\(reportId, dto\.viewType\)/);
    assert.match(src, /viewType: 'external'/);
  });

  it('dış onay maili dış PDF ekler', () => {
    const src = readFileSync(join(here, '../external-approvals/external-approvals.service.ts'), 'utf8');
    assert.match(src, /generate\(pdfReport as any, 'external'\)/);
    assert.match(src, /hasar-raporu-DIS-/);
    assert.doesNotMatch(src, /hasar-raporu-IC-/);
  });
});
