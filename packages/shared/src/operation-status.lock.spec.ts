/**
 * Kilit: dış onay bekleyen rapor «Onay Bekliyor».
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/operation-status.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { deriveClaimFileStageIndex } from './claim-file-stage.ts';
import {
  APPROVAL_WAITING_REPORT_STATUSES,
  ACIL_PRODUCT_STAGE_FILTERS,
  EMERGENCY_STATUS_PRODUCT_LABELS,
  FORBIDDEN_STAFF_CLAIM_STATUS_LABELS,
  HASAR_PRODUCT_STAGE_FILTERS,
  OPERATION_STAGES,
  deriveOperationStage,
  hasarListStatusQuery,
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

describe('ürün dili aşama filtresi LOCK', () => {
  it('Hasar ve Acil sıra numaralı ürün aşamaları; eksper/bütçe yok', () => {
    assert.deepEqual(
      HASAR_PRODUCT_STAGE_FILTERS.map((s) => `${s.sequenceNo}. ${s.label}`),
      [
        '1. Yeni İhbar',
        '2. Tespit Aşamasında',
        '3. Rapor Yazım Aşamasında',
        '4. Onay Bekliyor',
        '5. Onarım Aşamasında',
        '6. Finansa Aktarıldı',
        '7. Dosya Kapatıldı',
        '8. Dosya İptal Edildi',
      ],
    );
    assert.deepEqual(
      ACIL_PRODUCT_STAGE_FILTERS.map((s) => `${s.sequenceNo}. ${s.label}`),
      [
        '1. Yeni İhbar',
        '2. Hizmet verildi',
        '3. Dosya Kapatıldı',
        '4. Finansa Aktarıldı',
      ],
    );
    assert.equal(
      ACIL_PRODUCT_STAGE_FILTERS.some((s) => s.label === 'Tespit Aşamasında'),
      false,
    );
    assert.equal(EMERGENCY_STATUS_PRODUCT_LABELS.ATANDI, 'Yeni İhbar');
    assert.equal(EMERGENCY_STATUS_PRODUCT_LABELS.SAHADA, 'Hizmet verildi');
    const hasarLabels = HASAR_PRODUCT_STAGE_FILTERS.map((s) => s.label).join(' ');
    for (const forbidden of FORBIDDEN_STAFF_CLAIM_STATUS_LABELS) {
      assert.equal(hasarLabels.includes(forbidden), false, forbidden);
    }
    assert.equal(deriveOperationStage({ claimStatusCode: 'cancelled' }).label, 'Dosya İptal Edildi');
    assert.equal(OPERATION_STAGES.rapor_yaziliyor.label, 'Rapor Yazım Aşamasında');
    assert.equal(deriveOperationStage({ claimStatusCode: 'adjuster_assigned' }).label, 'Tespit Aşamasında');
    assert.equal(deriveOperationStage({ claimStatusCode: 'budget_preparing' }).label, 'Rapor Yazım Aşamasında');
    assert.deepEqual(hasarListStatusQuery('__stage__tespit'), {
      statusCode: 'pre_review,adjuster_assigned',
    });
    assert.deepEqual(hasarListStatusQuery('__open__'), { statusCode: 'open' });
  });
});
