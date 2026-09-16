/**
 * İl seçilince ülke değil o ilin haritası.
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/turkey-province-coords.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { provinceMapBounds, resolveProvinceCoords } from './turkey-province-coords.ts';

describe('il haritası görünümü LOCK', () => {
  it('Ankara seçilince il kutusu ülke haritasından dardır', () => {
    const ankara = resolveProvinceCoords('Ankara');
    const box = provinceMapBounds('Ankara');
    assert.ok(ankara);
    assert.ok(box);
    const [[south, west], [north, east]] = box;
    assert.ok(south < ankara.lat && ankara.lat < north);
    assert.ok(west < ankara.lng && ankara.lng < east);
    assert.ok(north - south < 2.2);
    assert.ok(east - west < 3);
    assert.ok(south > 36);
    assert.ok(north < 42.5);
  });

  it('il adı yoksa kutu yoktur', () => {
    assert.equal(provinceMapBounds(''), null);
    assert.equal(provinceMapBounds(null), null);
  });
});
