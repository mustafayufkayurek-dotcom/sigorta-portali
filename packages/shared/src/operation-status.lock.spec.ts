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
  claimStatusProductLabel,
  deriveOperationStage,
  hasarListStatusQuery,
  isApprovalWaitingReport,
  isHasarWorkloadOpenStage,
  isAcilWorkloadOpen,
  staffVisibleClaimStatusName,
  resolveEmergencyOperationLabel,
  tallyHasarOperationKpis,
  tallyAcilOperationKpis,
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
        '4. Revizyon Talep Edildi',
        '5. Onay Bekliyor',
        '6. Onarım Aşamasında',
        '7. Finansa Aktarıldı',
        '8. Dosya Kapatıldı',
        '9. Dosya İptal Edildi',
      ],
    );
    assert.deepEqual(
      ACIL_PRODUCT_STAGE_FILTERS.map((s) => `${s.sequenceNo}. ${s.label}`),
      [
        '1. Yeni İhbar',
        '2. Hizmet Verildi',
        '3. Dosya Kapatıldı',
        '4. Finansa Aktarıldı',
      ],
    );
    assert.equal(
      ACIL_PRODUCT_STAGE_FILTERS.some((s) => s.label === 'Tespit Aşamasında'),
      false,
    );
    assert.equal(EMERGENCY_STATUS_PRODUCT_LABELS.ATANDI, 'Yeni İhbar');
    assert.equal(EMERGENCY_STATUS_PRODUCT_LABELS.SAHADA, 'Hizmet Verildi');
    const hasarLabels = HASAR_PRODUCT_STAGE_FILTERS.map((s) => s.label).join(' ');
    for (const forbidden of FORBIDDEN_STAFF_CLAIM_STATUS_LABELS) {
      assert.equal(hasarLabels.includes(forbidden), false, forbidden);
    }
    assert.equal(deriveOperationStage({ claimStatusCode: 'cancelled' }).label, 'Dosya İptal Edildi');
    assert.equal(OPERATION_STAGES.rapor_yaziliyor.label, 'Rapor Yazım Aşamasında');
    assert.equal(deriveOperationStage({ claimStatusCode: 'adjuster_assigned' }).label, 'Tespit Aşamasında');
    assert.equal(deriveOperationStage({ claimStatusCode: 'budget_preparing' }).label, 'Rapor Yazım Aşamasında');
    assert.equal(staffVisibleClaimStatusName('adjuster_assigned', 'Eksper Atandı'), 'Tespit Aşamasında');
    assert.equal(staffVisibleClaimStatusName('budget_preparing', 'Bütçe Hazırlanıyor'), 'Rapor Yazım Aşamasında');
    assert.equal(staffVisibleClaimStatusName('cancelled', 'İptal'), 'Dosya İptal Edildi');
    assert.equal(claimStatusProductLabel('adjuster_assigned'), 'Tespit Aşamasında');
    assert.deepEqual(hasarListStatusQuery('__stage__tespit'), {
      statusCode: 'pre_review,adjuster_assigned',
    });
    assert.deepEqual(hasarListStatusQuery('__open__'), { statusCode: 'open' });
    assert.equal(deriveOperationStage({ claimStatusCode: 'budget_revision_requested' }).label, 'Revizyon Talep Edildi');
    assert.equal(staffVisibleClaimStatusName('budget_revision_requested', 'Bütçe Revize Talep Edildi'), 'Revizyon Talep Edildi');
  });
});

describe('son işlem kapanışı ezmez LOCK', () => {
  it('reddedilen rapor kapalı dosyada da Reddedildi kalır', () => {
    const stage = deriveOperationStage({
      claimStatusCode: 'closed',
      reportStatus: 'rejected',
    });
    assert.equal(stage.id, 'rapor_reddedildi');
    assert.equal(stage.label, 'Reddedildi');
  });

  it('dış red kapalı dosyada da Reddedildi kalır', () => {
    assert.equal(
      deriveOperationStage({
        claimStatusCode: 'closed',
        reportStatus: 'externally_rejected',
      }).label,
      'Reddedildi',
    );
  });

  it('revizyon talebi Rapor Yazım Aşamasında yazılmaz', () => {
    assert.equal(
      deriveOperationStage({
        claimStatusCode: 'budget_revision_requested',
        reportStatus: 'draft',
      }).label,
      'Revizyon Talep Edildi',
    );
    assert.equal(
      deriveOperationStage({
        claimStatusCode: 'budget_preparing',
        reportStatus: 'draft',
        verbalDecision: 'revise',
      }).label,
      'Revizyon Talep Edildi',
    );
  });

  it('onaya giden revize rapor Onay Bekliyor olur', () => {
    assert.equal(
      deriveOperationStage({
        claimStatusCode: 'budget_revision_requested',
        reportStatus: 'pending_approval',
        verbalDecision: 'revise',
      }).label,
      'Onay Bekliyor',
    );
  });

  it('onaylı rapor sonrası kapanış Dosya Kapatıldı kalır', () => {
    assert.equal(
      deriveOperationStage({
        claimStatusCode: 'closed',
        reportStatus: 'approved',
      }).label,
      'Dosya Kapatıldı',
    );
  });

  it('acil kapanış red/revizyonun üstüne yazılmaz', () => {
    assert.equal(
      resolveEmergencyOperationLabel({ status: 'COZULDU', notes: '[Manuel Red · gerekçe]' }),
      'Reddedildi',
    );
    assert.equal(
      resolveEmergencyOperationLabel({ status: 'COZULDU', notes: '[Manuel Revizyon · gerekçe]' }),
      'Revizyon Talep Edildi',
    );
    assert.equal(
      resolveEmergencyOperationLabel({ status: 'COZULDU' }),
      'Dosya Kapatıldı',
    );
  });
});

describe('hasar dosya sorumlusu KPI kartı LOCK', () => {
  it('red ve kapanış açık iş sayılmaz; rapor yazımı taslak artıklarından şişmez', () => {
    const todayRange = {
      from: new Date('2026-09-03T00:00:00+03:00'),
      to: new Date('2026-09-03T23:59:59.999+03:00'),
    };
    const tally = tallyHasarOperationKpis(
      [
        { claimStatusCode: 'budget_preparing', newestReportStatus: 'draft' },
        { claimStatusCode: 'budget_preparing', newestReportStatus: 'rejected' },
        { claimStatusCode: 'closed', newestReportStatus: null },
        { claimStatusCode: 'budget_submitted', newestReportStatus: 'pending_approval' },
        { claimStatusCode: 'pre_review', newestReportStatus: 'draft' },
        {
          claimStatusCode: 'repair_in_progress',
          newestReportStatus: 'approved',
          createdAt: '2026-09-03T08:00:00+03:00',
        },
      ],
      todayRange,
    );
    assert.equal(tally.openClaims, 4);
    assert.equal(tally.reportWriting, 2);
    assert.equal(tally.approvalPending, 1);
    assert.equal(tally.reportApproval, 1);
    assert.equal(tally.openedTodayClaims, 1);
    assert.equal(isHasarWorkloadOpenStage('rapor_reddedildi'), false);
    assert.equal(isHasarWorkloadOpenStage('rapor_yaziliyor'), true);
  });
});

describe('acil dosya sorumlusu KPI kartı LOCK', () => {
  it('red ve kapanış / finansa aktarım açık iş sayılmaz; revizyon açık kalır', () => {
    const todayRange = {
      from: new Date('2026-09-07T00:00:00+03:00'),
      to: new Date('2026-09-07T23:59:59.999+03:00'),
    };
    const tally = tallyAcilOperationKpis(
      [
        { status: 'GELEN', createdAt: '2026-09-07T08:00:00+03:00' },
        { status: 'ATANDI' },
        { status: 'SAHADA' },
        { status: 'COZULDU' },
        { status: 'FATURALANDILDI' },
        { status: 'GELEN', notes: '[Manuel Red · gerekçe]' },
        { status: 'COZULDU', notes: '[Manuel Revizyon · gerekçe]' },
      ],
      todayRange,
    );
    assert.equal(tally.openEmergency, 4);
    assert.equal(tally.openedTodayEmergency, 1);
    assert.equal(isAcilWorkloadOpen({ status: 'SAHADA' }), true);
    assert.equal(isAcilWorkloadOpen({ status: 'FATURALANDILDI' }), false);
    assert.equal(isAcilWorkloadOpen({ status: 'GELEN', notes: '[Manuel Red · x]' }), false);
    assert.equal(isAcilWorkloadOpen({ status: 'COZULDU', notes: '[Manuel Revizyon · x]' }), true);
  });
});
