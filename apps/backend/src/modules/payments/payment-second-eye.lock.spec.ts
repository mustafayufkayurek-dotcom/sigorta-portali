/**
 * Büyük para: Ödendi dosya sorumlusunda değil, finans personelindedir.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/modules/payments/payment-second-eye.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

describe('ödeme ikinci göz LOCK', () => {
  it('dosya sorumlusu Ödendi basamaz; işlemi yapan kaydolur', () => {
    const controller = readFileSync(join(here, 'payments.controller.ts'), 'utf8');
    const service = readFileSync(join(here, 'payments.service.ts'), 'utf8');
    assert.match(controller, /office_staff.*dto\.status === 'completed'/);
    assert.match(controller, /Ödendi işlemini finans personeli yapar/);
    assert.match(service, /vendorPaidByUserId/);
    assert.match(service, /createdByUserId/);
  });
});
