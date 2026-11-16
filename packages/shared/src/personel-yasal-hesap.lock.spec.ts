/**
 * Personel yasal hesap (C8) kilidi.
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/personel-yasal-hesap.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  canAcceptPersonelYasalHesap,
  ihbarHaftaHesapla,
  proposePersonelYasalHesap,
} from './personel-yasal-hesap.ts';

describe('Personel yasal hesap LOCK', () => {
  it('sıfır brütte kabul yok; pozitifte net ve işveren maliyeti çıkar', () => {
    const bos = proposePersonelYasalHesap({ brutAylik: 0, iseGiris: '2020-01-01' });
    assert.equal(bos.kabulEdilebilir, false);
    assert.equal(canAcceptPersonelYasalHesap(bos), false);

    const s = proposePersonelYasalHesap({
      brutAylik: 50_000,
      iseGiris: '2020-01-15',
      istenCikis: '2026-01-15',
    });
    assert.equal(s.brutAylik, 50_000);
    assert.ok(s.isciSgk > 0);
    assert.ok(s.netAylik > 0 && s.netAylik < 50_000);
    assert.ok(s.isverenToplamMaliyet > 50_000);
    assert.equal(s.kabulEdilebilir, true);
    assert.ok(s.kidemYil >= 5.9 && s.kidemYil <= 6.1);
    assert.equal(s.kidemTazminati, 300_000);
    assert.equal(s.ihbarHafta, 8);
    assert.ok(s.ihbarTazminati > 0);
  });

  it('ihbar haftası 4857 basamaklarına uyar', () => {
    assert.equal(ihbarHaftaHesapla(0.2), 2);
    assert.equal(ihbarHaftaHesapla(1), 4);
    assert.equal(ihbarHaftaHesapla(2), 6);
    assert.equal(ihbarHaftaHesapla(4), 8);
  });

  it('işe giriş yoksa kıdem ve ihbar sıfırdır', () => {
    const s = proposePersonelYasalHesap({ brutAylik: 40_000, iseGiris: null });
    assert.equal(s.kidemTazminati, 0);
    assert.equal(s.ihbarTazminati, 0);
    assert.equal(s.kabulEdilebilir, true);
  });
});
