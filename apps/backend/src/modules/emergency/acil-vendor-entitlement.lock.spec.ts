/**
 * Kilit: Acil hakediş dosya bazlı, tarih-saatli, vade yok. Hasar 15/30 vade buraya girmez.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/modules/emergency/acil-vendor-entitlement.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  acilHakedisDueDate,
  acilHakedisFinanceNote,
  pickAcilHakedisAmount,
  toAcilFinanceQueueRow,
} from './acil-vendor-entitlement.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('acil vendor entitlement LOCK', () => {
  it('tutarı dosya giderinden alır', () => {
    assert.equal(
      pickAcilHakedisAmount(
        [
          { entryType: 'gider', amount: 950, vendorId: 'v1' },
          { entryType: 'gelir', amount: 1350, vendorId: null },
        ],
        'v1',
      ),
      950,
    );
  });

  it('vade üretmez', () => {
    assert.equal(acilHakedisDueDate(15), null);
    assert.equal(acilHakedisDueDate(30), null);
    assert.match(acilHakedisFinanceNote(new Date('2026-08-21T14:40:00+03:00')), /Vade yok/);
  });

  it('finans kuyruk satırında vade yok', () => {
    const row = toAcilFinanceQueueRow({
      id: 'e1',
      caseId: 'c1',
      caseNo: 'AY-DEMO-OK-01',
      vendorName: 'Tedarikçi',
      amount: 950,
      grantedAt: new Date('2026-08-21T14:40:00+03:00'),
      vendorPaid: false,
    });
    assert.equal(row.dueDate, null);
    assert.equal(row.queueSource, 'acil_hakedis');
    assert.match(row.note, /Vade yok/);
  });

  it('Hasar statement / paymentDueDays yoluna bağlanmaz', () => {
    const svc = readFileSync(join(here, 'emergency-finance.service.ts'), 'utf8');
    assert.match(svc, /emergencyVendorEntitlement/);
    assert.doesNotMatch(svc, /paymentDueDays/);
    assert.doesNotMatch(svc, /VendorPaymentStatement/);
    const chain = readFileSync(join(here, 'emergency-operation-chain.ts'), 'utf8');
    assert.match(chain, /vendorEntitlementGrantedAt/);
    assert.match(chain, /Vade yok/);
    const payments = readFileSync(join(here, '../payments/payments.service.ts'), 'utf8');
    assert.match(payments, /isAvansPayment/);
    assert.match(payments, /toAcilFinanceQueueRow/);
  });
});
