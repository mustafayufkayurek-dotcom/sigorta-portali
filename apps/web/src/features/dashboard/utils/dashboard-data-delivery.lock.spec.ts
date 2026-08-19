/**
 * Dashboard veri gönderimi — zarf, kapsam, kuyruk ve KPI kilitleri.
 * Çalıştır: node --experimental-strip-types --test src/features/dashboard/utils/dashboard-data-delivery.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { asDashboardItemList, unwrapDashboardData } from './dashboard-envelope.ts';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(join(here, rel), 'utf8');

describe('dashboard data delivery lock', () => {
  it('zarf ve ham listeyi ayırır', () => {
    const rows = [{ id: 'a' }];
    assert.deepEqual(asDashboardItemList({ success: true, data: rows }), rows);
    assert.deepEqual(asDashboardItemList({ items: rows }), rows);
    assert.deepEqual(asDashboardItemList(rows), rows);
    assert.equal(unwrapDashboardData({ success: true, data: { total: 3 } }).total, 3);
  });

  it('yönetim KPI iskeleti anket/sahiplik yüklemesine kilitlenmez', () => {
    const hook = read('../components/management-dashboard/use-management-dashboard-data.ts');
    assert.match(hook, /kpiLoading/);
    assert.doesNotMatch(hook, /surveysQuery\.isLoading/);
    assert.match(hook, /Anket Verisi Alınamadı/);
    assert.doesNotMatch(
      hook,
      /opsQuery\.isLoading \|\|\s*slaQuery\.isLoading \|\|\s*ownershipQuery\.isLoading/,
    );
  });

  it('ofis bekleyen operasyonlar finans 403 isteği atmaz', () => {
    const hook = read('../hooks/use-pending-operations.ts');
    assert.match(hook, /useFinanceBottlenecks\(showFinanceWidgets\)/);
    assert.match(hook, /usePanelAccess/);
  });

  it('aktivite satırı dosya id ile detaya gider', () => {
    const feed = read('../components/activity/activity-feed-widget.tsx');
    assert.match(feed, /claimNavHref\(\{ id: item\.claimFileId, fileNo: item\.fileNo \}\)/);
    const office = read('../components/admin/office-bottom-row.tsx');
    assert.match(office, /id: item\.claimFileId/);
    const types = read('../types/dashboard.ts');
    assert.match(types, /claimFileId\?:/);
  });

  it('finans KPI biri hata verse diğer kartları gizlemez', () => {
    const kpi = read('../components/finance/finance-kpi-group.tsx');
    assert.match(kpi, /plFailed && bottlenecksFailed/);
    assert.doesNotMatch(kpi, /const isError = plQuery\.isError/);
  });

  it('ofis KPI sayıları daily-flow beklenmeden görünür', () => {
    const office = read('../components/admin/office-kpi-band.tsx');
    assert.doesNotMatch(office, /dailyQuery\.isLoading/);
  });
});
