/**
 * Tahsilat fatura seçilmeden kaydedilir; boş invoiceId FK kırmaz.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/modules/payments/payment-invoice-id.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

describe('tahsilat boş fatura LOCK', () => {
  it('boş Seçiniz invoice_id FK yazılmaz', () => {
    const src = readFileSync(join(here, 'payments.service.ts'), 'utf8');
    assert.match(src, /export function optionalPaymentFkId/);
    const createStart = src.indexOf('async create(dto: CreatePaymentDto');
    const createEnd = src.indexOf('async uploadReceipt');
    assert.ok(createStart >= 0 && createEnd > createStart);
    const create = src.slice(createStart, createEnd);
    assert.match(create, /optionalPaymentFkId\(dto\.invoiceId\)/);
    assert.doesNotMatch(create, /invoiceId: dto\.invoiceId \?\? null/);
  });
});
