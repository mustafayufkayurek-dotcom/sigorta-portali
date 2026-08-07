/**
 * Operasyon Planlayıcısı — WA/dijital yeşil + finans gerçek rakam regresyonu.
 * Çalıştır: node --experimental-strip-types apps/web/src/components/hasar-operasyon-planlayicisi/claim-snapshot.regression.test.ts
 */
import assert from 'node:assert/strict';
import {
  computePlannerStepStatuses,
  formatLiveReportFinance,
} from './planner-live-rules.ts';

const report = {
  id: 'rr-1',
  reportNo: 'HR-2026-0099',
  status: 'draft',
  totalSalesAmount: 57100,
  totalSupplierCost: 56000,
  grossProfit: 1100,
  grossMarginPct: 1.9,
};

{
  const statuses = computePlannerStepStatuses({
    hasAppt: true,
    hasInspector: true,
    hasSupplier: true,
    activity: [],
    report,
  });
  assert.notEqual(statuses.whatsapp, 'done');
  assert.equal(statuses.whatsapp, 'waiting');
  assert.equal(statuses.digital_approval, 'future');
}

{
  const statuses = computePlannerStepStatuses({
    hasAppt: true,
    hasInspector: true,
    hasSupplier: true,
    activity: [
      {
        action: 'WHATSAPP_STATUS_RECORDED',
        description: 'WhatsApp işlemi kaydedildi: sent.',
        metadata: { status: 'sent' },
      },
    ],
    report,
  });
  assert.equal(statuses.whatsapp, 'done');
  assert.equal(statuses.digital_approval, 'waiting');
}

{
  const statuses = computePlannerStepStatuses({
    hasAppt: true,
    hasInspector: true,
    hasSupplier: true,
    activity: [
      { action: 'WHATSAPP_STATUS_RECORDED', metadata: { status: 'sent' } },
      {
        action: 'NOTE_ADDED',
        metadata: { kind: 'digital_approval', status: 'approved', formType: 'Mutabakat' },
      },
    ],
    report,
  });
  assert.equal(statuses.digital_approval, 'done');
}

{
  const finance = formatLiveReportFinance(report);
  assert.match(finance.total, /57\.100/);
  assert.match(finance.supplierCost, /56\.000/);
  assert.match(finance.profit, /1\.100/);
  assert.doesNotMatch(finance.total, /48\.500/);
}

console.log('claim-snapshot.regression.test.ts PASS');
