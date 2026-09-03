/**
 * Kilit: Hasar kartları vekalet OR'su rapor yazımı filtresini ezmez.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/modules/claim-files/hasar-kpi-scope.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const SERVICE = readFileSync(new URL('./claim-files.service.ts', import.meta.url), 'utf8');
const PAGE = readFileSync(
  new URL('../../../../web/src/app/panel/hasar-dosyalari/page.tsx', import.meta.url),
  'utf8',
);

describe('hasar KPI kapsam LOCK', () => {
  it('vekalet kapsamı Object.assign ile OR ezmez; mergeWhereAnd kullanır', () => {
    assert.equal(SERVICE.includes('Object.assign(baseWhere, delegationWhere)'), false);
    assert.match(SERVICE, /mergeWhereAnd\(scopedWhere, delegationWhere\)/);
    assert.match(SERVICE, /tallyHasarOperationKpis/);
    assert.match(SERVICE, /claimFileIdsNotWorkloadOpen/);
  });

  it('dosya sorumlusu kartı kendi atanan dosyasıyla sayılır', () => {
    assert.match(PAGE, /assignedOfficeUserId: officeStaffUserId/);
    assert.match(PAGE, /claim-files-operation-stats/);
  });
});
