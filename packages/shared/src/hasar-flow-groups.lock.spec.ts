import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  HASAR_FLOW_GROUP_LABEL,
  HASAR_WA_KAPANIS,
  HASAR_WA_ONARIM,
  HASAR_WA_ONAY,
  canCreateHasarInvoiceRequest,
  isAvansPaymentNote,
  isRepairCompletionPhotoNote,
  repairCompletionPhotoNote,
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
});
