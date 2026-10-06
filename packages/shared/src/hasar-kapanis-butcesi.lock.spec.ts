/**
 * Onarım yapılmadan kapanış bütçesi.
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/hasar-kapanis-butcesi.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  buildKapanisTahsilatWhatsAppMessage,
  CLOSE_BILLABLE_QUESTION,
  hasarKapanisCloseMissing,
  parseHasarKapanisButce,
  serializeHasarKapanisButce,
} from './hasar-kapanis-butcesi.ts';
import { hasarOfficeCloseMissing } from './hasar-office-close.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('hasar kapanış bütçesi lock', () => {
  it('Hayır ile onarım bitişi aranmaz; Evet sırayı ister', () => {
    assert.equal(CLOSE_BILLABLE_QUESTION, 'Fatura Edilecek Masraf / Hizmet Var mı?');
    assert.deepEqual(
      hasarOfficeCloseMissing({
        statusCode: 'repair_planning',
        hasApprovedReport: false,
        remainingRepairDropped: true,
        hasBillable: false,
        customerAgreed: false,
        hasInvoiceRequest: false,
      }),
      [],
    );
    assert.deepEqual(
      hasarKapanisCloseMissing({
        remainingRepairDropped: true,
        hasBillable: true,
        customerAgreed: false,
        closeBudgetStartedAt: null,
        hasInvoiceRequest: false,
      }),
      ['Kapanış bütçesi', 'Müşteri mutabık', 'Tahsilat bilgi yazısı', 'Fatura talebi'],
    );
    assert.doesNotMatch(buildKapanisTahsilatWhatsAppMessage({ insuredName: 'Ali', fileNo: '1' }), /Onayla/);
    const round = parseHasarKapanisButce(
      serializeHasarKapanisButce({
        remainingRepairDropped: true,
        hasBillable: true,
        customerAgreed: true,
        infoWhatsappAt: '2026-10-04T10:00:00.000Z',
        closeBudgetStartedAt: '2026-10-04T09:00:00.000Z',
      }),
    );
    assert.equal(round.remainingRepairDropped, true);
    assert.equal(round.hasBillable, true);
  });

  it('kapatma tuşu finans ofisi olmaz; duran ekranlara gider', () => {
    const steps = readFileSync(
      join(here, '../../../apps/web/src/components/hasar-operasyon-planlayicisi/steps.tsx'),
      'utf8',
    );
    assert.match(steps, /Kalan onarım yok/);
    assert.match(steps, /CLOSE_BILLABLE_QUESTION/);
    assert.match(steps, /grup=finans/);
    assert.match(steps, /HasarSalesInvoiceRequestCard/);
    assert.match(steps, /Onarıma dön/);
    assert.doesNotMatch(steps, /Onayla'ya basın/);
  });
});
