/**
 * Kilit: Acil listede tedarikçi ödemesi (ödendi / ödenmedi) görünür.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/utils/acil-vendor-pay.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acilVendorPayLabel, acilVendorPayMatchesFilter, acilVendorPayMatchesQuery } from './acil-vendor-pay.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('acil tedarikçi ödemesi liste LOCK', () => {
  it('etiket üç hal', () => {
    assert.equal(acilVendorPayLabel(true), 'Ödendi');
    assert.equal(acilVendorPayLabel(false), 'Ödenmedi');
    assert.equal(acilVendorPayLabel(null), 'Kayıt yok');
    assert.equal(acilVendorPayMatchesFilter(true, 'paid'), true);
    assert.equal(acilVendorPayMatchesFilter(false, 'unpaid'), true);
    assert.equal(acilVendorPayMatchesFilter(null, 'none'), true);
    assert.equal(acilVendorPayMatchesQuery(true, 'ödendi'), true);
  });

  it('Acil listede sütun durur; Hasar kuyruğunda Ödemeler ayrı durur', () => {
    const ops = readFileSync(join(here, '../app/panel/operasyon/page.tsx'), 'utf8');
    assert.match(ops, /id: 'vendorPay'/);
    assert.match(ops, /Ödeme Durumu/);
    assert.match(ops, /Ödemeler/);
    assert.match(ops, /ACIL_TABLE_COLUMNS/);
    assert.match(ops, /table-cols:operasyon-acil-v17/);
    assert.match(ops, /table-cols:operasyon-hasar-v12/);
    assert.match(ops, /alwaysVisible: true/);
    assert.match(ops, /acil-odeme-durumu-sutun/);
    assert.match(ops, /hasar-odeme-durumu-sutun/);
    assert.match(ops, /acil-odeme-filtre/);
    assert.match(ops, /resolveAcilListVendorPaid/);
    const picker = readFileSync(join(here, '../components/ui/TableColumnPicker.tsx'), 'utf8');
    assert.match(picker, /alwaysVisible\?: boolean/);
    assert.match(picker, /c\.id === id && c\.alwaysVisible/);
    assert.match(picker, /locked = pinned \|\| Boolean\(col\.alwaysVisible\)/);
    const hasarListe = readFileSync(join(here, '../app/panel/hasar-dosyalari/page.tsx'), 'utf8');
    assert.match(hasarListe, /id: 'vendorPay'/);
    assert.match(hasarListe, /Ödemeler/);
    assert.match(hasarListe, /alwaysVisible: true/);
    assert.match(hasarListe, /table-cols:hasar-dosyalari-v8/);
    assert.match(hasarListe, /hasar-liste-odeme/);
    assert.doesNotMatch(hasarListe, /dueDate/);
  });

  it('ödeme dosyadan sunucuya yazılır', () => {
    const events = readFileSync(
      join(here, '../app/panel/acil-yardim/[id]/acil-process-events.ts'),
      'utf8',
    );
    const backend = readFileSync(
      join(here, '../../../backend/src/modules/emergency/emergency-process-events.ts'),
      'utf8',
    );
    const emergencySvc = readFileSync(
      join(here, '../../../backend/src/modules/emergency/emergency-cases.service.ts'),
      'utf8',
    );
    const claimSvc = readFileSync(
      join(here, '../../../backend/src/modules/claim-files/claim-files.service.ts'),
      'utf8',
    );
    const schema = readFileSync(
      join(here, '../../../backend/prisma/schema.prisma'),
      'utf8',
    );
    assert.match(events, /EMERGENCY_VENDOR_PAYMENT_RECORDED/);
    assert.match(backend, /EMERGENCY_VENDOR_PAYMENT_RECORDED/);
    assert.match(emergencySvc, /applyVendorPaid/);
    assert.match(claimSvc, /attachVendorPaid/);
    assert.match(claimSvc, /vendorPaidFromOutgoingStatuses/);
    assert.match(schema, /vendorPaid\s+Boolean\?/);
    assert.doesNotMatch(schema, /\/\*\*/);
    const finans = readFileSync(join(here, '../app/panel/acil-yardim/finans/page.tsx'), 'utf8');
    assert.match(finans, /Tedarikçi Ödemesi/);
    assert.match(finans, /acil-finans-odeme-filtre/);
  });
});
