/**
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/hasar-hakedis-payment-split.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  hakedisPaidRemaining,
  splitHakedisPaymentAmount,
} from './hasar-hakedis-payment-split.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('Hakediş kısmi ödeme LOCK', () => {
  it('10.000 üzerinden 4.000 ödenince 6.000 kalan doğar', () => {
    const split = splitHakedisPaymentAmount({ originalAmount: 10_000, payAmount: 4_000 });
    assert.equal(split.ok, true);
    if (split.ok) {
      assert.equal(split.paid, 4_000);
      assert.equal(split.remaining, 6_000);
      assert.equal(split.isPartial, true);
    }
  });

  it('fazla ödeme reddedilir', () => {
    const bad = splitHakedisPaymentAmount({ originalAmount: 10_000, payAmount: 12_000 });
    assert.equal(bad.ok, false);
  });

  it('ödendi / kalan özeti', () => {
    assert.deepEqual(hakedisPaidRemaining(10_000, 4_000), {
      total: 10_000,
      paid: 4_000,
      remaining: 6_000,
    });
  });

  it('ödeme servisi kısmi bölme ve masraf yazımı kullanır; cari otomatik açılmaz', () => {
    const pay = readFileSync(
      join(here, '../../../apps/backend/src/modules/payments/payments.service.ts'),
      'utf8',
    );
    assert.match(pay, /splitHakedisPaymentAmount/);
    assert.match(pay, /postHakedisPaymentExpense/);
    assert.match(pay, /remainderPending/);

    const party = readFileSync(
      join(here, '../../../apps/backend/src/modules/finance/party-accounts.service.ts'),
      'utf8',
    );
    assert.match(party, /linkedVendorId: input\.vendorId/);
    assert.match(party, /Her ödemede cari açılmaz/);

    const ui = readFileSync(
      join(here, '../../../apps/web/src/app/panel/finans/tahsilatlar/page.tsx'),
      'utf8',
    );
    assert.match(ui, /splitHakedisPaymentAmount/);
    assert.match(ui, /finans-hakedis-odeme-kutusu/);
    assert.match(ui, /openPayDialog/);
  });
});
