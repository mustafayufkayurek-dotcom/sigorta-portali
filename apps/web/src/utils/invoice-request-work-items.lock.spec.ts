/**
 * Fatura talebi iş kalemi — satış fiyatı etiketi yerine yapılan iş.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/utils/invoice-request-work-items.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { InvoiceRequest } from './invoiceRequestApi.ts';
import { invoiceRequestWorkItems } from './invoice-request-work-items.ts';

describe('invoice-request-work-items lock', () => {
  it('Meridyen Satış Fiyatı yerine dosya konusunu basar', () => {
    const req = {
      id: '1',
      requestNo: 'FT-1',
      serviceType: 'emergency',
      fileNo: 'AY-1',
      totalAmount: 3500,
      workItemsSummary: [{ description: 'Meridyen Satış Fiyatı', amount: 3500 }],
      status: 'pending',
      createdAt: '2026-08-30',
      emergencyCase: { id: 'e1', caseNo: 'AY-1', issueType: 'Çilingir' },
    } as InvoiceRequest;
    assert.equal(invoiceRequestWorkItems(req)[0]?.description, 'Çilingir');
  });
});
