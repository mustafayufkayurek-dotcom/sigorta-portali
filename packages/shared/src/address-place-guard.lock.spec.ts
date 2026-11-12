/**
 * Açık adres ile seçilen il çelişirse kayıt durur.
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/address-place-guard.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readOpenAddressPlace } from './address-place-guard.ts';

const catalog = [
  { plateCode: 6, name: 'Ankara', districts: ['Çankaya', 'Yenimahalle'] },
  { plateCode: 34, name: 'İstanbul', districts: ['Bahçelievler', 'Kadıköy', 'Pendik'] },
];

describe('açık adres konum kilidi', () => {
  it('posta kodu ve ilçe seçilen ilden farklıysa kaydı keser', () => {
    const place = readOpenAddressPlace(
      'Bahçelievler, Zümrüt Cd. No:1, 34893 Pendik İstanbul',
      catalog,
      { city: 'Ankara', district: 'Çankaya' },
    );
    assert.equal(place.city, 'İstanbul');
    assert.equal(place.district, 'Pendik');
    assert.match(place.conflict || '', /Pendik, İstanbul/);
    assert.match(place.conflict || '', /Ankara/);
    assert.match(place.conflict || '', /Kayıt durdu/);
  });

  it('mahalle adı ilçeyi ezmez', () => {
    const place = readOpenAddressPlace(
      'Bahçelievler Mahallesi, Zümrüt Cd. No:1, Çankaya, Ankara',
      catalog,
      { city: 'Ankara', district: 'Çankaya' },
    );
    assert.equal(place.conflict, null);
    assert.equal(place.city, 'Ankara');
    assert.equal(place.district, 'Çankaya');
  });

  it('adres ile seçim aynıysa kayıt açık kalır', () => {
    const place = readOpenAddressPlace(
      'Zümrüt Cd. No:1, Pendik, İstanbul',
      catalog,
      { city: 'İstanbul', district: 'Pendik' },
    );
    assert.equal(place.conflict, null);
  });

  it('adreste il yoksa seçilen ili bozmaz', () => {
    const place = readOpenAddressPlace(
      'Zümrüt Cd. No:1',
      catalog,
      { city: 'Ankara', district: 'Çankaya' },
    );
    assert.equal(place.conflict, null);
    assert.equal(place.city, null);
  });
});
