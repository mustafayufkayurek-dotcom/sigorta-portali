/**
 * Dosya sorumlusu Hasar / Acil listesi tablo yüzüdür; daralınca kart liste açılmaz.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/utils/office-list-table.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const webSrc = join(here, '..');
const read = (rel: string) => readFileSync(join(webSrc, rel), 'utf8');

describe('dosya sorumlusu liste tablo LOCK', () => {
  it('Hasar ofiste tablo durur; kart yalnız sahada', () => {
    const hasar = read('app/panel/hasar-dosyalari/page.tsx');
    assert.match(hasar, /hasar-ofis-tablo/);
    assert.match(hasar, /isFieldStaff \? 'hidden' : 'hasar-ofis-tablo'/);
    assert.match(hasar, /hasar-saha-kart-liste/);
    assert.match(hasar, /isFieldStaff \? 'grid gap-3 p-3' : 'hidden'/);
    assert.doesNotMatch(hasar, /isFieldStaff \? '' : 'lg:hidden'/);
    assert.match(hasar, /hasar-kpi-band/);
    assert.match(hasar, /grid grid-cols-5 gap-2 overflow-x-auto/);
  });

  it('Acil ofiste tablo durur; dar kart liste kapalı', () => {
    const ops = read('app/panel/operasyon/page.tsx');
    assert.match(ops, /ops-ofis-tablo/);
    assert.match(ops, /ops-dar-kart-liste-kapali/);
    assert.match(ops, /ops-kpi-band-acil/);
    assert.match(ops, /grid grid-cols-5 gap-2 overflow-x-auto" data-testid="ops-kpi-band-acil"/);
    assert.doesNotMatch(ops, /Mobil \/ tablet kart/);
  });
});
