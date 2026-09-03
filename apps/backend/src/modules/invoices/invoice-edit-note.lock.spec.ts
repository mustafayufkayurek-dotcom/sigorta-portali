/**
 * Fatura düzenleme nedeni notta durur.
 * Çalıştır: node --experimental-strip-types --test src/modules/invoices/invoice-edit-note.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { appendInvoiceEditNote, staffDisplayName } from './invoice-edit-note.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('invoice-edit-note lock', () => {
  it('düzenleme nedenini nota ekler', () => {
    const at = new Date('2026-09-03T08:00:00.000Z');
    assert.equal(appendInvoiceEditNote(null, 'Yanlış numara', at), 'Düzenleme (03.09.2026): Yanlış numara');
    assert.equal(
      appendInvoiceEditNote('Demo not', 'Tutar düzeltildi', at),
      'Demo not\nDüzenleme (03.09.2026): Tutar düzeltildi',
    );
    assert.equal(staffDisplayName({ firstName: 'Sezgi', lastName: 'Yılmaz' }), 'Sezgi Yılmaz');
  });

  it('PATCH fatura düzenleme nedeni ister; bildirim zile düşer', () => {
    const dto = readFileSync(join(here, 'dto/update-invoice.dto.ts'), 'utf8');
    assert.match(dto, /editReason/);
    const service = readFileSync(join(here, 'invoices.service.ts'), 'utf8');
    assert.match(service, /Düzenleme nedeni zorunludur/);
    assert.match(service, /appendInvoiceEditNote/);
    assert.match(service, /recipients/);
    assert.match(service, /sales_invoice_issued/);
  });
});
