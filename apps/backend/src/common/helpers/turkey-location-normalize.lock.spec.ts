/**
 * İl adı alias / ASCII katlama.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/common/helpers/turkey-location-normalize.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  foldLocationKey,
  locationNameVariants,
  matchNamedLocation,
  splitCombinedLocation,
} from './turkey-location-normalize.ts';

const PROVINCES = [
  { name: 'Afyonkarahisar' },
  { name: 'Kocaeli' },
  { name: 'Kütahya' },
  { name: 'Kahramanmaraş' },
  { name: 'Uşak' },
];

describe('turkey location normalize LOCK', () => {
  it('Afyon, Kutahya ve Usak resmi ile eşleşir', () => {
    assert.equal(foldLocationKey('Afyon'), 'afyon');
    assert.equal(matchNamedLocation('Afyon', PROVINCES)?.name, 'Afyonkarahisar');
    assert.equal(matchNamedLocation('Kutahya', PROVINCES)?.name, 'Kütahya');
    assert.equal(matchNamedLocation('Usak', PROVINCES)?.name, 'Uşak');
    assert.deepEqual(locationNameVariants('Afyon'), ['Afyon', 'Afyonkarahisar']);
  });

  it('Kocaeli Kartepe birleşik etiketi il + ilçeye ayrılır', () => {
    const names = PROVINCES.map((row) => row.name);
    assert.deepEqual(splitCombinedLocation('Kocaeli Kartepe', names), {
      city: 'Kocaeli',
      district: 'Kartepe',
    });
    assert.deepEqual(splitCombinedLocation('Kütahya', names), {
      city: 'Kütahya',
      district: null,
    });
  });
});
