import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { netHakedisAfterAvans, resolveHasarAvansHesap } from '../../../../packages/shared/src/hasar-flow-groups.ts';
import { buildAvansMahsupIslemleri, buildHasarHakedisOzet } from './hasar-hakedis-ozet.ts';

function uiVeBackendNet(input: Parameters<typeof resolveHasarAvansHesap>[0], brut: number) {
  const hesap = resolveHasarAvansHesap(input);
  const ozet = buildHasarHakedisOzet({
    sozlesmeTutari: 20000,
    onayliHakedisToplam: 0,
    buTalepBrut: brut,
    avansToplam: hesap.avansToplam,
    oncekiMahsupToplam: hesap.alreadyMahsup,
  });
  const backendNet = netHakedisAfterAvans(brut, hesap.usableAvans);
  return { hesap, ozet, backendNet };
}

describe('hasar avans UI = backend LOCK', () => {
  it('ilk hakedişte tamamlanmış avans mahsup edilir', () => {
    const { ozet, backendNet } = uiVeBackendNet({
      payments: [{ amount: 2500, status: 'completed', referenceNo: 'AVANS' }],
    }, 12500);
    assert.equal(ozet.netOdenecek, 10000);
    assert.equal(backendNet, ozet.netOdenecek);
  });

  it('ikinci hakedişte aynı avans yeniden düşülmez', () => {
    const { ozet, backendNet } = uiVeBackendNet({
      payments: [
        { amount: 2500, status: 'completed', referenceNo: 'AVANS' },
        { amount: 2500, status: 'completed', method: 'offset', referenceNo: 'HAKEDIS-MAHSUP:EKS-1' },
      ],
      statements: [{ id: 's1', notes: 'Hasar hakediş — X · avans mahsup 2500' }],
    }, 5000);
    assert.equal(ozet.netOdenecek, 5000);
    assert.equal(backendNet, ozet.netOdenecek);
  });

  it('kısmi mahsup kalan avansı kullanır', () => {
    const { ozet, backendNet, hesap } = uiVeBackendNet({
      payments: [
        { amount: 4000, status: 'completed', note: '[AVANS] eski' },
        { amount: 1500, status: 'completed', method: 'offset', referenceNo: 'HAKEDIS-MAHSUP:EKS-2' },
      ],
    }, 3000);
    assert.equal(hesap.usableAvans, 2500);
    assert.equal(ozet.netOdenecek, 500);
    assert.equal(backendNet, ozet.netOdenecek);
  });

  it('avans hakedişten büyükse net sıfırdır', () => {
    const { ozet, backendNet } = uiVeBackendNet({
      payments: [{ amount: 9000, status: 'completed', referenceNo: 'AVANS' }],
    }, 4000);
    assert.equal(ozet.netOdenecek, 0);
    assert.equal(backendNet, ozet.netOdenecek);
  });

  it('bekleyen avans mahsup edilmez', () => {
    const { ozet, backendNet, hesap } = uiVeBackendNet({
      payments: [{ amount: 2500, status: 'pending', referenceNo: 'AVANS' }],
    }, 12500);
    assert.equal(hesap.usableAvans, 0);
    assert.equal(hesap.bekleyenAvans, 2500);
    assert.equal(ozet.netOdenecek, 12500);
    assert.equal(backendNet, ozet.netOdenecek);
  });

  it('sözleşme ve öneri yoksa Eksik, sıfır uydurulmaz', () => {
    const ozet = buildHasarHakedisOzet({});
    assert.equal(ozet.sozlesme.amount, null);
    assert.equal(ozet.onerilen.amount, null);
    assert.ok(ozet.eksikler.length > 0);
  });

  it('aynı hakediş mahsubu ikinci kez listeye girmez', () => {
    const rows = buildAvansMahsupIslemleri({
      payments: [
        { id: 'p1', amount: 2500, method: 'offset', referenceNo: 'HAKEDIS-MAHSUP:EKS-1' },
        { id: 'p2', amount: 2500, method: 'offset', referenceNo: 'HAKEDIS-MAHSUP:EKS-1' },
      ],
      statements: [{ id: 's1', notes: 'Hasar hakediş — X · avans mahsup 2500', statementNo: 'EKS-1' }],
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.tutar, 2500);
  });
});
