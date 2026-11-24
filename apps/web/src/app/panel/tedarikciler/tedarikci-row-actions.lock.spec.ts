/**
 * Tedarikçi satır işlemleri müşteri/Hasar ikon kabuğudur.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/app/panel/tedarikciler/tedarikci-row-actions.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const page = readFileSync(join(here, 'page.tsx'), 'utf8');
const actions = readFileSync(join(here, '../../../components/vendors/VendorRowActions.tsx'), 'utf8');

describe('tedarikçi satır işlemleri LOCK', () => {
  it('ikon kabuğu durur; indigo Detay yazısı yok', () => {
    assert.match(page, /VendorRowActions/);
    assert.match(page, /ops-queue-table/);
    assert.match(page, /İşlemler/);
    assert.doesNotMatch(page, /bg-indigo-600 hover:bg-indigo-700/);
    assert.match(actions, /Görüntüle/);
    assert.match(actions, /Düzenle/);
    assert.match(actions, /Sil/);
    assert.doesNotMatch(actions, /PDF|Mail|WhatsApp/);
    assert.doesNotMatch(page, /toggleSelectAll/);
  });

  it('ekleme çekmecesinde alt işlem alanında Geri / Devam / Kaydet durur', () => {
    assert.match(page, /flex h-full min-h-0 flex-col overflow-hidden/);
    assert.match(page, /flex-1 overflow-y-auto/);
    assert.match(page, /data-testid="tedarikci-form-footer"/);
    assert.match(page, />\s*Geri\s*</);
    assert.match(page, />\s*Devam\s*</);
    assert.match(page, /Kaydet ve Kapat/);
    assert.doesNotMatch(page, /grid-rows-\[auto_auto_auto_minmax\(0,1fr\)_auto\]/);
  });

  it('KPI şeridi müşteri kartıdır; konum hızlı okunur', () => {
    assert.match(page, /OpsStripKpi/);
    assert.match(page, /OpsKpiSegmentBand/);
    assert.match(page, /tedarikci-kpi-band/);
    assert.match(page, /embedded/);
    assert.equal((page.match(/<OpsStripKpi/g) ?? []).length, 3);
    assert.match(page, /colId="location"/);
    assert.match(page, /id === 'location'/);
  });
});
