/**
 * Kilit: Acil açık dosya kartı listedeki Durum ile aynı kuraldan sayılır.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/modules/claim-files/acil-kpi-scope.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const SERVICE = readFileSync(new URL('./claim-files.service.ts', import.meta.url), 'utf8');
const PAGE = readFileSync(
  new URL('../../../../web/src/app/panel/operasyon/page.tsx', import.meta.url),
  'utf8',
);

describe('acil KPI kapsam LOCK', () => {
  it('sunucu Acil açık sayıyı tallyAcilOperationKpis ile üretir; ham COZULDU sayacı yok', () => {
    assert.match(SERVICE, /tallyAcilOperationKpis/);
    assert.match(SERVICE, /emergencyCase.findMany/);
    assert.equal(SERVICE.includes('status: { notIn: [...closedEmergency] }'), false);
  });

  it('dosya sorumlusu Acil listesi kartı yüklenen dosyadan sayılır; Açık Dosyalar süzgeci durur', () => {
    assert.match(PAGE, /acilKpiTally\.openEmergency/);
    assert.match(PAGE, /workloadOpen/);
    assert.match(PAGE, /filterAcilStage === '__open__'/);
    assert.match(PAGE, /assignedOfficeUserId/);
    assert.match(PAGE, /Dosya Bedeli \(KDV Hariç\)/);
    assert.match(PAGE, /acil-konu-filtre/);
    assert.match(PAGE, /acil-donem-filtre/);
  });
});
