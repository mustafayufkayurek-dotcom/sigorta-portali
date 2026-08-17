/**
 * Kilit: Onaya gitmiş rapor PDF’sinde Taslak damgası yok.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/modules/repair-reports/pdf/report-pdf-draft.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const specDir = dirname(fileURLToPath(import.meta.url));
const pdfSrc = readFileSync(join(specDir, 'report-pdf.service.ts'), 'utf8');
const approvalSrc = readFileSync(
  join(specDir, '../../external-approvals/external-approvals.service.ts'),
  'utf8',
);

describe('onarım raporu PDF Taslak damgası LOCK', () => {
  it('PDF isDraft yalnız isRepairReportPdfDraft ile hesaplanır', () => {
    assert.match(pdfSrc, /isRepairReportPdfDraft\(report\.status, report\.approvalHistory\)/);
    assert.doesNotMatch(
      pdfSrc,
      /const isDraft = report\.status === 'draft'/,
    );
  });

  it('dış onay maili PDF’i status güncellemesinden sonra taze kayıtla üretir', () => {
    assert.match(approvalSrc, /sendApprovalEmail\(approval\.id, reportId,/);
    assert.match(approvalSrc, /repairReport\.findUnique\(\{\s*where: \{ id: reportId \}/);
    assert.match(approvalSrc, /approvalHistory:/);
  });
});
