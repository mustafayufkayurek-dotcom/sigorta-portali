/**
 * Yandex tek rota tedarikçisi + kısa / uygun maliyet seçimi.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/modules/hasar-tespit-bedel/rota-yandex.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { secKisaUygunMaliyetliRota } from './rota.util.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('Yandex rota LOCK', () => {
  it('kaynak yalnız Yandex; OSRM yok', () => {
    const src = readFileSync(join(here, 'rota.util.ts'), 'utf8');
    assert.match(src, /api\.routing\.yandex\.net/);
    assert.match(src, /YANDEX_ROUTING_API_KEY|YANDEX_MAPS_API_KEY/);
    assert.doesNotMatch(src, /router\.project-osrm\.org/);
    assert.match(src, /secKisaUygunMaliyetliRota/);
    assert.match(src, /avoid_tolls/);
  });

  it('ücretsiz kısa rota makul farkta tercih edilir', () => {
    const secim = secKisaUygunMaliyetliRota([
      { km: 100, dakika: 90, koordinatlar: [], ucretliYol: true },
      { km: 110, dakika: 100, koordinatlar: [], ucretliYol: false },
    ]);
    assert.ok(secim);
    assert.equal(secim!.secilen.ucretliYol, false);
    assert.equal(secim!.secim, 'ucretsiz_kisa');
  });

  it('ücretsiz çok uzunsa en kısa seçilir', () => {
    const secim = secKisaUygunMaliyetliRota([
      { km: 100, dakika: 90, koordinatlar: [], ucretliYol: true },
      { km: 160, dakika: 140, koordinatlar: [], ucretliYol: false },
    ]);
    assert.ok(secim);
    assert.equal(secim!.secilen.km, 100);
    assert.equal(secim!.secim, 'kisa');
  });
});
