/**
 * Hasar ofis kapanış / iptal kuralları.
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/hasar-office-close.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  HASAR_CANCEL_REASON_MIN_LEN,
  hasarCancelActorName,
  hasarCancelReasonOk,
  hasarOfficeCloseMissing,
  pickHasarCancelHistory,
} from './hasar-office-close.ts';

describe('hasar ofis kapanış / iptal', () => {
  it('onarım bitmeden ve onaylı rapor yokken kapatılmaz', () => {
    assert.deepEqual(
      hasarOfficeCloseMissing({ statusCode: 'repair_planning', hasApprovedReport: false }),
      ['Onaylı rapor', 'Onarım bitişi'],
    );
    assert.deepEqual(
      hasarOfficeCloseMissing({ statusCode: 'repair_completed', hasApprovedReport: true }),
      [],
    );
    assert.deepEqual(
      hasarOfficeCloseMissing({ statusCode: 'cancelled', hasApprovedReport: true }),
      ['İptal edilmiş dosya kapatılmaz'],
    );
  });

  it('iptal açıklaması kısa olmaz; iptal kaydı kişiyi verir', () => {
    assert.equal(hasarCancelReasonOk('kısa'), false);
    assert.equal(HASAR_CANCEL_REASON_MIN_LEN, 10);
    assert.equal(hasarCancelReasonOk('Sigortalı hizmeti iptal etti.'), true);
    const row = pickHasarCancelHistory([
      { toStatus: { code: 'closed' }, changedByUser: { firstName: 'A', lastName: 'B' } },
      {
        toStatus: { code: 'cancelled' },
        changedAt: '2026-09-02T12:00:00.000Z',
        note: 'Hizmet iptal',
        changedByUser: { firstName: 'Ayşe', lastName: 'Kaya' },
      },
    ]);
    assert.equal(row?.note, 'Hizmet iptal');
    assert.equal(hasarCancelActorName(row?.changedByUser), 'Ayşe Kaya');
  });
});
