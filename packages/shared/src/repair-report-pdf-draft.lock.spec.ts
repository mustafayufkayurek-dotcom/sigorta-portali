/**
 * Çalıştır:
 *   node --experimental-strip-types --test packages/shared/src/repair-report-pdf-draft.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isRepairReportPdfDraft } from './repair-report-pdf-draft.ts';

describe('repair report PDF Taslak damgası LOCK', () => {
  it('yalnız taslak / boş durumda damga basar', () => {
    assert.equal(isRepairReportPdfDraft('draft'), true);
    assert.equal(isRepairReportPdfDraft(null), true);
    assert.equal(isRepairReportPdfDraft(''), true);
  });

  it('onaya gönderilmiş veya onay sürecindeki raporda Taslak basmaz', () => {
    assert.equal(isRepairReportPdfDraft('pending_approval'), false);
    assert.equal(isRepairReportPdfDraft('sent_for_external_approval'), false);
    assert.equal(isRepairReportPdfDraft('submitted'), false);
    assert.equal(isRepairReportPdfDraft('approved'), false);
    assert.equal(isRepairReportPdfDraft('externally_approved'), false);
    assert.equal(isRepairReportPdfDraft('rejected'), false);
  });

  it('status hâlâ draft olsa bile onaya gönderme kaydı varsa Taslak basmaz', () => {
    assert.equal(
      isRepairReportPdfDraft('draft', [{ action: 'sent_for_external_approval' }]),
      false,
    );
    assert.equal(
      isRepairReportPdfDraft('draft', [{ action: 'pending_approval' }]),
      false,
    );
  });
});
