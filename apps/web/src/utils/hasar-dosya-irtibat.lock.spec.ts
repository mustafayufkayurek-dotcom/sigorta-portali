/**
 * Hasar ofis ekranı — Yeni Dosya’daki irtibat, dosya sorumlusunda durur.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/utils/hasar-dosya-irtibat.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  hasarIrtibatAdi,
  hasarIrtibatTelHref,
  hasarIrtibatTelefonGosterim,
} from './hasar-dosya-irtibat.ts';

const here = dirname(fileURLToPath(import.meta.url));
const detay = readFileSync(
  join(here, '../app/panel/hasar-dosyalari/[id]/_components/DosyaBilgileriDetay.tsx'),
  'utf8',
);
const duzenle = readFileSync(
  join(here, '../app/panel/hasar-dosyalari/[id]/_components/DosyaBilgileriEditModal.tsx'),
  'utf8',
);

describe('hasar dosya irtibat lock', () => {
  it('kayıtlı irtibat adı ve telefonu okunur; TR gösterim durur', () => {
    const claim = { siteContactName: 'Gonca Hanım', siteContactPhone: '05065149718' };
    assert.equal(hasarIrtibatAdi(claim), 'Gonca Hanım');
    assert.equal(hasarIrtibatTelefonGosterim(claim), '506 514 9718');
    assert.equal(hasarIrtibatTelHref(claim), 'tel:+905065149718');
    assert.equal(hasarIrtibatAdi({ siteContactName: '  ' }), '');
    assert.equal(hasarIrtibatTelefonGosterim({ siteContactPhone: null }), '');
  });

  it('Dosya Bilgileri Detay ve Düzenle irtibatı basar', () => {
    assert.match(detay, /hasarIrtibatAdi/);
    assert.match(detay, /İrtibat Ad Soyad/);
    assert.match(detay, /İrtibat Telefon/);
    assert.match(detay, /ozet\.irtibatName/);
    assert.match(duzenle, /İrtibat Ad Soyad/);
    assert.match(duzenle, /İrtibat Telefon/);
    assert.match(duzenle, /siteContactName/);
    assert.match(duzenle, /siteContactPhone/);
  });
});
