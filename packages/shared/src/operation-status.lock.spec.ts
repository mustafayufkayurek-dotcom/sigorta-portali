/**
 * Kilit: dış onay bekleyen rapor «Onay Bekliyor».
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/operation-status.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { deriveClaimFileStageIndex } from './claim-file-stage.ts';
import {
  APPROVAL_WAITING_REPORT_STATUSES,
  EMERGENCY_STATUS_PRODUCT_LABELS,
  OPERATION_STAGES,
  deriveOperationStage,
  isApprovalWaitingReport,
} from './operation-status.ts';

describe('dış onay = Onay Bekliyor LOCK', () => {
  it('sent_for_external_approval onay bekleyen kümede', () => {
    assert.ok(
      (APPROVAL_WAITING_REPORT_STATUSES as readonly string[]).includes(
        'sent_for_external_approval',
      ),
    );
    assert.equal(isApprovalWaitingReport('sent_for_external_approval'), true);
  });

  it('operasyon etiketi Onay Bekliyor; Onarım Aşamasında değil', () => {
    const stage = deriveOperationStage({
      claimStatusCode: 'pre_review',
      reportStatus: 'sent_for_external_approval',
    });
    assert.equal(stage.id, 'onay_bekliyor');
    assert.equal(stage.label, 'Onay Bekliyor');
  });

  it('dosya akışı ilk adım Onay Bekliyor', () => {
    assert.equal(
      deriveClaimFileStageIndex({ reportStatus: 'sent_for_external_approval' }),
      0,
    );
  });
});

describe('rapor onaylandı ≠ liste «Onaylanan Dosyalar» LOCK', () => {
  it('onaylı rapor ürün etiketinde Onaylanan Dosyalar yazmaz; Onarım Aşamasında basar', () => {
    const byReport = deriveOperationStage({
      claimStatusCode: 'budget_submitted',
      reportStatus: 'approved',
    });
    assert.equal(byReport.id, 'onaylandi');
    assert.equal(byReport.label, 'Onarım Aşamasında');
    assert.equal(OPERATION_STAGES.onaylandi.label, 'Onarım Aşamasında');
    const byBudget = deriveOperationStage({
      claimStatusCode: 'budget_approved',
      reportStatus: null,
    });
    assert.equal(byBudget.id, 'onaylandi');
    assert.equal(byBudget.label, 'Onarım Aşamasında');
  });

  it('Acil yardım ürün durumlarında rapor onay kuyruğu yok', () => {
    assert.deepEqual(Object.keys(EMERGENCY_STATUS_PRODUCT_LABELS), [
      'GELEN',
      'ATANDI',
      'SAHADA',
      'COZULDU',
      'FATURALANDILDI',
    ]);
    assert.equal(
      Object.values(EMERGENCY_STATUS_PRODUCT_LABELS).includes('Onaylanan Dosyalar'),
      false,
    );
    assert.equal(
      Object.values(EMERGENCY_STATUS_PRODUCT_LABELS).includes('Bütçe Onaylandı'),
      false,
    );
  });
});
