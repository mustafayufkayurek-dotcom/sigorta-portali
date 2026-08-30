import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  HASAR_FLOW_GROUP_LABEL,
  HASAR_WA_KAPANIS,
  HASAR_WA_ONARIM,
  HASAR_WA_ONAY,
  canCreateHasarInvoiceRequest,
  isAvansPayment,
  isAvansPaymentNote,
  isHakedisMahsupPayment,
  isRepairCompletionPhotoNote,
  netHakedisAfterAvans,
  parseAvansMahsupFromNote,
  resolveHasarAvansHesap,
  repairCompletionPhotoNote,
  usableAvansForHakedis,
  scaleAmountsToNet,
  vendorsMissingRepairPhotos,
  withAvansNote,
} from './hasar-flow-groups.ts';

describe('hasar-flow-groups lock', () => {
  it('üç grup etiketi durur', () => {
    assert.equal(HASAR_FLOW_GROUP_LABEL.onay, 'Hasar Tespit Aşaması');
    assert.equal(HASAR_FLOW_GROUP_LABEL.onarim, 'Onarım Aşaması');
    assert.equal(HASAR_FLOW_GROUP_LABEL.kapanis, 'Dosya Kapanış');
  });

  it('tespit WhatsApp onay grubunda, onarım ayrı, kapanış ankette', () => {
    assert.ok(HASAR_WA_ONAY.includes('whatsapp_hasar_randevu_sigortali'));
    assert.ok(HASAR_WA_ONARIM.includes('whatsapp_hasar_onarim_tedarikci'));
    assert.ok(HASAR_WA_KAPANIS.includes('whatsapp_hasar_kapanis_anket'));
    assert.equal(
      HASAR_WA_ONAY.some((t) => String(t).includes('onarim')),
      false,
    );
  });

  it('fatura talebi kapanış ve sözleşme beklemez', () => {
    assert.equal(
      canCreateHasarInvoiceRequest({
        muvafakatnameDigitallyApproved: true,
        repairReportApproved: true,
      }),
      true,
    );
    assert.equal(
      canCreateHasarInvoiceRequest({
        muvafakatnameDigitallyApproved: true,
        repairReportApproved: false,
      }),
      true,
    );
    assert.equal(
      canCreateHasarInvoiceRequest({
        muvafakatnameDigitallyApproved: false,
        repairReportApproved: true,
      }),
      false,
    );
  });

  it('onarım bitiş resmi tedarikçiye bağlanır', () => {
    const note = repairCompletionPhotoNote('v1', 'Servis A');
    assert.equal(isRepairCompletionPhotoNote(note, 'v1'), true);
    assert.equal(isRepairCompletionPhotoNote(note, 'v2'), false);
    assert.deepEqual(
      vendorsMissingRepairPhotos(['v1', 'v2'], [{ notes: note }]),
      ['v2'],
    );
  });

  it('avans notu dosyaya yazılır', () => {
    assert.equal(isAvansPaymentNote('[AVANS] 5000'), true);
    assert.match(withAvansNote('acil nakit'), /^\[AVANS\]/);
  });

  it('ödenmiş avans hakedişten düşülür', () => {
    assert.equal(netHakedisAfterAvans(8200, 2500), 5700);
    assert.deepEqual(scaleAmountsToNet([5000, 3200], 5700), [3475.61, 2224.39]);
  });

  it('önceki mahsup kullanılabilir avansı düşer', () => {
    assert.equal(parseAvansMahsupFromNote('Hasar hakediş — X · avans mahsup 2500'), 2500);
    assert.equal(usableAvansForHakedis(2500, 2500), 0);
    assert.equal(netHakedisAfterAvans(5000, usableAvansForHakedis(2500, 2500)), 5000);
  });

  it('not ayrıştırması eski biçimleri okur, yanlış pozitifi düşmez', () => {
    assert.equal(parseAvansMahsupFromNote('AVANS MAHSUP: 2.500'), 2500);
    assert.equal(parseAvansMahsupFromNote('Avans   Mahsup 2500'), 2500);
    assert.equal(parseAvansMahsupFromNote('[AVANS-MAHSUP] 1.250,50'), 1250.5);
    assert.equal(parseAvansMahsupFromNote('avans mahsup yok'), 0);
    assert.equal(parseAvansMahsupFromNote('avans mahsup edilmedi'), 0);
    assert.equal(parseAvansMahsupFromNote('mahsup avansı 2500'), 0);
    assert.equal(parseAvansMahsupFromNote('avans talebi 2500'), 0);
  });

  it('avans hesabı referansı birincil, not fallback; bekleyen düşülmez', () => {
    const first = resolveHasarAvansHesap({
      payments: [
        { amount: 2500, status: 'completed', referenceNo: 'AVANS', note: null },
        { amount: 1000, status: 'pending', referenceNo: 'AVANS', note: null },
      ],
    });
    assert.equal(first.avansToplam, 2500);
    assert.equal(first.bekleyenAvans, 1000);
    assert.equal(first.usableAvans, 2500);
    assert.equal(netHakedisAfterAvans(12500, first.usableAvans), 10000);

    const second = resolveHasarAvansHesap({
      payments: [
        { amount: 2500, status: 'completed', referenceNo: 'AVANS', note: null },
        { amount: 2500, status: 'completed', method: 'offset', referenceNo: 'HAKEDIS-MAHSUP:EKS-1' },
      ],
      statements: [{ id: 's1', notes: 'Hasar hakediş — X · avans mahsup 2500' }],
    });
    assert.equal(second.alreadyMahsup, 2500);
    assert.equal(second.usableAvans, 0);
    assert.equal(netHakedisAfterAvans(5000, second.usableAvans), 5000);

    const partial = resolveHasarAvansHesap({
      payments: [
        { amount: 4000, status: 'completed', note: '[AVANS] eski' },
        { amount: 1500, status: 'completed', method: 'offset', referenceNo: 'HAKEDIS-MAHSUP:EKS-2' },
      ],
    });
    assert.equal(partial.usableAvans, 2500);
    assert.equal(netHakedisAfterAvans(3000, partial.usableAvans), 500);

    const over = resolveHasarAvansHesap({
      payments: [{ amount: 9000, status: 'completed', referenceNo: 'AVANS' }],
    });
    assert.equal(netHakedisAfterAvans(4000, over.usableAvans), 0);

    const sameTwice = resolveHasarAvansHesap({
      payments: [
        { amount: 2500, status: 'completed', method: 'offset', referenceNo: 'HAKEDIS-MAHSUP:EKS-1' },
        { amount: 2500, status: 'completed', method: 'offset', referenceNo: 'HAKEDIS-MAHSUP:EKS-1' },
      ],
    });
    assert.equal(sameTwice.alreadyMahsup, 2500);
    assert.equal(isAvansPayment({ referenceNo: 'AVANS', note: null }), true);
    assert.equal(isHakedisMahsupPayment({ method: 'offset', referenceNo: 'HAKEDIS-MAHSUP:EKS-1' }), true);
  });
});
