/**
 * İç PDF yalnız Meridyen yönetici mailine; müşteriye gitmez.
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/repair-report-mail-pdf.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  canAttachInternalRepairPdf,
  filterRepairReportMailAttachments,
  internalRepairPdfFilename,
  isInternalRepairPdfFilename,
  packInlineMailAttachments,
} from './repair-report-mail-pdf.ts';

describe('rapor mail iç PDF LOCK', () => {
  it('yönetici Meridyen kutusuna iç PDF açılır; müşteri ve eksper kapalıdır', () => {
    assert.equal(canAttachInternalRepairPdf('mustafa@meridyen-tr.com'), true);
    assert.equal(canAttachInternalRepairPdf('sezgi@sezgiglobal.com'), false);
    assert.equal(canAttachInternalRepairPdf('eksper@ofis.com'), false);
    assert.equal(canAttachInternalRepairPdf('hasar@allianz.com'), false);
    assert.equal(canAttachInternalRepairPdf('ihbar@safranbh.com'), false);
    assert.equal(canAttachInternalRepairPdf('hasar@meridyen-tr.com'), false);
  });

  it('iç dosya adı IC üretir; müşteri ekinden ayıklanır', () => {
    assert.equal(internalRepairPdfFilename('RPT-837296-001'), 'hasar-raporu-IC-RPT-837296-001.pdf');
    assert.equal(isInternalRepairPdfFilename('hasar-raporu-IC-RPT-837296-001.pdf'), true);
    assert.equal(isInternalRepairPdfFilename('hasar-raporu-DIS-RPT-837296-001.pdf'), false);
    const kept = filterRepairReportMailAttachments('sezgi@sezgiglobal.com', [
      { filename: 'hasar-raporu-IC-RPT-1.pdf' },
      { filename: 'resim.jpg' },
    ]);
    assert.deepEqual(kept.map((a) => a.filename), ['resim.jpg']);
    const manager = filterRepairReportMailAttachments('ayse@meridyen-tr.com', [
      { filename: 'hasar-raporu-IC-RPT-1.pdf' },
      { filename: 'resim.jpg' },
    ]);
    assert.deepEqual(manager.map((a) => a.filename), ['hasar-raporu-IC-RPT-1.pdf', 'resim.jpg']);
  });

  it('önce iç PDF durur; sığmayan resim düşer', () => {
    const pdf = { filename: 'hasar-raporu-IC-1.pdf', content: { length: 2_000_000 } };
    const img = { filename: 'resim.jpg', content: { length: 2_000_000 } };
    const packed = packInlineMailAttachments([pdf, img], 3_000_000);
    assert.deepEqual(packed.map((a) => a.filename), ['hasar-raporu-IC-1.pdf']);
  });
});
