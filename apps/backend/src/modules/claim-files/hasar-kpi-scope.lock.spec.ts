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
    assert.match(PAGE, /hasarProductStageFilterValue\('onay_bekliyor'\)/);
    assert.match(PAGE, /hasarProductStageFilterValue\('rapor_yazim'\)/);
    assert.match(PAGE, /istanbulYmd/);
  });

  it('kartlar listenin hizmet ve müşteri kaynağı süzgeciyle sayar (Hasar Tespit 10 dosya → kart 10)', () => {
    assert.match(PAGE, /\['claim-files-operation-stats', officeStaffUserId, urlHizmet, urlKaynak\]/);
    assert.match(PAGE, /\[HASAR_LIST_HIZMET_PARAM\]: urlHizmet/);
    assert.match(PAGE, /\[MUSTERI_KAYNAK_PARAM\]: urlKaynak/);
    assert.match(SERVICE, /claimFileWhereForHizmet\(params\?\.hizmet\)/);
    assert.match(SERVICE, /claimFileWhereForMusteriKaynak\(params\?\.kaynak\)/);
    assert.match(SERVICE, /where: stageWhere as any/);
  });

  it('ortalanmış liste hücresi iki yandan kesilmez; Dosya Konusu ve Dosya No tam okunur', () => {
    const picker = readFileSync(
      new URL('../../../../web/src/components/ui/TableColumnPicker.tsx', import.meta.url),
      'utf8',
    );
    assert.match(picker, /centeredTruncate \? \(/);
    assert.match(picker, /block min-w-0 max-w-full truncate whitespace-nowrap/);
    assert.match(PAGE, /key="subject" colId="subject" align="center" wrap/);
    assert.match(PAGE, /key="fileNo" colId="fileNo" wrap/);
  });
});
