/**
 * Müşteri liste KPI şeridi Hasar kartıdır; Kısa Ad uyarısı bu kartta değil.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/app/panel/musteriler/musteri-kpi.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const page = readFileSync(join(here, 'page.tsx'), 'utf8');
const actions = readFileSync(join(here, '../../../components/customers/CustomerRowActions.tsx'), 'utf8');

describe('müşteri KPI şeridi LOCK', () => {
  it('Hasar kartı ile üç iş kartı durur; Kısa Ad kartı yok', () => {
    assert.match(page, /OpsStripKpi/);
    assert.match(page, /musteri-kpi-band/);
    assert.match(page, /label="Toplam"/);
    assert.match(page, /label="Bireysel"/);
    assert.equal((page.match(/<OpsStripKpi/g) ?? []).length, 3);
    assert.doesNotMatch(page, /MissingShortNameBanner/);
  });

  it('satır işlemleri ikon kabuğudur', () => {
    assert.match(page, /CustomerRowActions/);
    assert.match(page, /ops-queue-table/);
    assert.match(actions, /Görüntüle/);
    assert.match(actions, /Düzenle/);
    assert.match(actions, /Arşivle/);
    assert.doesNotMatch(actions, /PDF|Mail|WhatsApp/);
  });
});
