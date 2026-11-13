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

  it('yol, cadde, sokak ve bulvar adındaki il / ilçe çelişki sayılmaz', () => {
    const wide = [
      ...catalog,
      { plateCode: 26, name: 'Eskişehir', districts: ['Odunpazarı'] },
      { plateCode: 42, name: 'Konya', districts: ['Selçuklu'] },
      { plateCode: 35, name: 'İzmir', districts: ['Konak'] },
      { plateCode: 43, name: 'Kütahya', districts: ['Dumlupınar'] },
      { plateCode: 7, name: 'Antalya', districts: ['Kemer', 'Muratpaşa'] },
    ];
    for (const [address, city, district] of [
      ['Eskişehir Yolu No:12 Çankaya', 'Ankara', 'Çankaya'],
      ['Konya Yolu Üzeri No:3', 'Ankara', 'Yenimahalle'],
      ['Ankara Caddesi No:5 Kadıköy', 'İstanbul', 'Kadıköy'],
      ['İzmir Cd. No:4 Kızılay', 'Ankara', 'Çankaya'],
      ['Dumlupınar Bulvarı No:346 Ankara', 'Ankara', ''],
      ['Merkez Mahallesi Kemer Sokak No:1', 'Antalya', 'Muratpaşa'],
    ]) {
      assert.equal(readOpenAddressPlace(address, wide, { city, district }).conflict, null, address);
    }
  });

  it('adreste il yoksa aynı adlı başka ilin ilçesi değil seçilen il esastır', () => {
    const twin = [
      { plateCode: 6, name: 'Ankara', districts: ['Gölbaşı', 'Çankaya'] },
      { plateCode: 2, name: 'Adıyaman', districts: ['Gölbaşı'] },
    ];
    const place = readOpenAddressPlace('Atatürk Mahallesi Gölbaşı', twin, { city: 'Ankara', district: 'Gölbaşı' });
    assert.equal(place.conflict, null);
    assert.equal(place.city, 'Ankara');
  });
});
