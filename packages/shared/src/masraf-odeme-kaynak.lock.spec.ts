/**
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/masraf-odeme-kaynak.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  mergeMasrafOdemeKaynaklari,
  parseMasrafPendingVendorId,
  masrafPendingVendorOptionId,
} from './masraf-odeme-kaynak.ts';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../../..');

describe('masraf ödeme kaynağı LOCK', () => {
  it('carisi olmayan tedarikçi listede durur; cari olan çift yazılmaz', () => {
    const rows = mergeMasrafOdemeKaynaklari({
      accounts: [
        {
          id: 'pa-1',
          name: 'Garanti Kart',
          kindLabel: 'Kredi Kartı',
          kind: 'kredi_karti',
          linkedVendorId: null,
        },
        {
          id: 'pa-2',
          name: 'Local Kabul',
          kindLabel: 'Tedarikçi',
          kind: 'tedarikci',
          linkedVendorId: 'v-local',
        },
      ],
      vendors: [
        { id: 'v-local', name: 'Local Kabul', status: 'active' },
        { id: 'v-bkc', name: 'Bkc Temizlik', status: 'active' },
        { id: 'v-pasif', name: 'Pasif Firma', status: 'passive' },
      ],
    });
    assert.equal(rows.some((r) => r.name === 'Bkc Temizlik'), true);
    assert.equal(
      rows.filter((r) => r.linkedVendorId === 'v-local').length,
      1,
      'Local Kabul çift satır olmaz',
    );
    assert.equal(rows.some((r) => r.name === 'Pasif Firma'), false);
    const pending = rows.find((r) => r.name === 'Bkc Temizlik');
    assert.equal(pending?.id, masrafPendingVendorOptionId('v-bkc'));
    assert.equal(parseMasrafPendingVendorId(pending!.id), 'v-bkc');
    assert.equal(parseMasrafPendingVendorId('pa-1'), null);
  });

  it('masraf ve dosya masrafı tedarikçi kartını Ödeme Kaynağına birleştirir', () => {
    const masraf = readFileSync(
      join(root, 'apps/web/src/app/panel/finans/masraflar/page.tsx'),
      'utf8',
    );
    const claim = readFileSync(
      join(root, 'apps/web/src/components/finance/ClaimFileExpenseFormPanel.tsx'),
      'utf8',
    );
    const svc = readFileSync(
      join(root, 'apps/backend/src/modules/finance/party-accounts.service.ts'),
      'utf8',
    );
    const vendorsSvc = readFileSync(
      join(root, 'apps/backend/src/modules/vendors/vendors.service.ts'),
      'utf8',
    );
    const vendorsCtrl = readFileSync(
      join(root, 'apps/backend/src/modules/vendors/vendors.controller.ts'),
      'utf8',
    );
    const paCtrl = readFileSync(
      join(root, 'apps/backend/src/modules/finance/party-accounts.controller.ts'),
      'utf8',
    );
    assert.match(masraf, /mergeMasrafOdemeKaynaklari/);
    assert.match(masraf, /ensure-vendor/);
    assert.match(masraf, /status: 'active'/);
    assert.match(masraf, /totalPages/);
    assert.match(masraf, /limit: 150/);
    assert.match(masraf, /kendiliğinden açılır|otomatik tamamlanır/);
    assert.match(claim, /mergeMasrafOdemeKaynaklari/);
    assert.match(claim, /totalPages/);
    assert.match(svc, /resolveActorUserId/);
    assert.match(svc, /partyAccounts: \{ every: \{ isActive: false \} \}/);
    // Kural: aktif tedarikçi = cari; liste/detay/toplu kapılar
    assert.match(vendorsSvc, /ensureActiveVendorCariler/);
    assert.match(vendorsSvc, /ensureSingleVendorCari/);
    assert.match(vendorsCtrl, /ensureActiveVendorCariler/);
    assert.match(paCtrl, /ensure-all-vendors/);
  });
});
