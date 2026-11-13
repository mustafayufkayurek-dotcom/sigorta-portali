/**
 * Hasar Tespit hizmet bedeli hesabı kilidi.
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/hasar-tespit-bedel.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_HASAR_TESPIT_TARIFE,
  aracGunlukKira,
  ayCalismaGunu,
  bedelGiderKategorisi,
  bedelGiderSatirlari,
  gecisSatirlari,
  hesaplaHasarTespitBedeli,
  normalizeHasarTespitArac,
  rotaGecisleri,
  type HasarTespitBedelGirdi,
} from './hasar-tespit-bedel.ts';

const here = dirname(fileURLToPath(import.meta.url));

function girdi(over: Partial<HasarTespitBedelGirdi> = {}): HasarTespitBedelGirdi {
  return {
    rotaKm: 100,
    gidisDonus: true,
    yakitTuru: 'motorin',
    yakitFiyati: 50,
    tuketimL100: 10,
    kmAsimUcreti: 2,
    aylikKira: 25000,
    gun: 1,
    tarih: new Date(Date.UTC(2026, 10, 13)),
    gecisler: [],
    otoyollar: [],
    tarife: { ...DEFAULT_HASAR_TESPIT_TARIFE, yontem: 'maliyet_arti', hizmetPayiSabit: 1000, hizmetPayiYuzde: 10 },
    ...over,
  };
}

describe('Hasar Tespit hizmet bedeli LOCK', () => {
  it('araç kirası gün payı Pazar düşülerek hesaplanır', () => {
    assert.equal(ayCalismaGunu(2026, 10), 25);
    const k = aracGunlukKira(25000, new Date(Date.UTC(2026, 10, 13)));
    assert.equal(k.calismaGunu, 25);
    assert.equal(k.gunluk, 1000);
  });

  it('maliyetler + hizmet payı satır satır toplanır; km aşımı her km', () => {
    const s = hesaplaHasarTespitBedeli(girdi());
    assert.equal(s.toplamKm, 200);
    const by = Object.fromEntries(s.satirlar.map((r) => [r.kod, r.tutar]));
    assert.equal(by.yakit, 1000);
    assert.equal(by.km_asim, 400);
    assert.equal(by.arac_kira, 1000);
    assert.equal(s.maliyetToplami, 2400);
    assert.equal(s.hizmetPayi, 1240);
    assert.equal(s.bedel, 3640);
    assert.deepEqual(s.eksikler, []);
  });

  it('köprü gidiş-dönüş adedi yönüne göre; ücret yoksa uyarı', () => {
    const ayar = normalizeHasarTespitArac(null);
    const gecis = gecisSatirlari(['osmangazi', '15-temmuz'], ayar.gecisler, true);
    assert.deepEqual(gecis.map((g) => [g.id, g.adet]), [['osmangazi', 2], ['15-temmuz', 1]]);
    const s = hesaplaHasarTespitBedeli(girdi({ gecisler: gecis }));
    assert.ok(s.eksikler.some((e) => e.includes('Osmangazi')));
    assert.ok(s.satirlar.every((r) => r.ad !== 'Osmangazi Köprüsü' || r.tutar === 0));
  });

  it('rota köprünün üstünden geçince geçiş bulunur, uzaktan geçince bulunmaz', () => {
    const ayar = normalizeHasarTespitArac(null);
    assert.deepEqual(rotaGecisleri([[29.5150, 40.7538]], ayar.gecisler), ['osmangazi']);
    assert.deepEqual(rotaGecisleri([[29.40, 40.80]], ayar.gecisler), []);
  });

  it('sabit tarife ve asgari / azami sınır', () => {
    const sabit = hesaplaHasarTespitBedeli(girdi({
      tarife: { ...DEFAULT_HASAR_TESPIT_TARIFE, yontem: 'sabit', sabitBedel: 5000, azamiBedel: 4500 },
    }));
    assert.equal(sabit.bedelHam, 5000);
    assert.equal(sabit.bedel, 4500);
    assert.equal(sabit.sinirUygulandi, 'azami');
  });

  it('ek kalem adet ve yüzde', () => {
    const s = hesaplaHasarTespitBedeli(girdi({
      tarife: {
        ...DEFAULT_HASAR_TESPIT_TARIFE,
        yontem: 'maliyet_arti',
        hizmetPayiSabit: 0,
        hizmetPayiYuzde: 0,
        ekKalemler: [
          { id: 'rapor', ad: 'Rapor Hazırlama', tur: 'adet', deger: 750, varsayilanMiktar: 1 },
          { id: 'risk', ad: 'Risk Payı', tur: 'yuzde', deger: 5, varsayilanMiktar: 1 },
        ],
      },
    }));
    assert.equal(s.tarifeToplami, 750 + 120);
    assert.equal(s.bedel, 2400 + 870);
  });

  it('gider satırları dosya giderine kategoriyle yazılır; tarife ve pay gelirdir', () => {
    const s = hesaplaHasarTespitBedeli(girdi());
    const gider = bedelGiderSatirlari(s);
    assert.deepEqual(gider.map((r) => r.kod), ['yakit', 'km_asim', 'arac_kira']);
    assert.equal(bedelGiderKategorisi('yakit').kategoriKodu, 'OPR_ARAC_YAKIT');
    assert.equal(bedelGiderKategorisi('arac_kira').kategoriKodu, 'OPR_ARAC_KIRA');
    assert.equal(bedelGiderKategorisi('gecis:osmangazi').altGrup, 'Araç Giderleri – Köprü Ve Otoyol');
  });

  it('varsayılan geçişlerde uydurma ücret yok', () => {
    const ayar = normalizeHasarTespitArac(null);
    assert.ok(ayar.gecisler.length >= 6);
    assert.ok(ayar.gecisler.every((g) => g.ucret === null));
    assert.equal(ayar.aylikKira, null);
  });

  it('kaynak: kalıcı sabitler ve kilit kapısı', () => {
    const src = readFileSync(join(here, 'hasar-tespit-bedel.ts'), 'utf8');
    assert.match(src, /HASAR_TESPIT_ARAC_AYAR_KEY = 'hasar_tespit_arac_giderleri'/);
    assert.match(src, /HASAR_TESPIT_TARIFE_KEY = 'hasar_tespit_tarifeleri'/);
    const smoke = readFileSync(join(here, '../../../scripts/smoke-canli-bitmis-is.sh'), 'utf8');
    assert.match(smoke, /hasar-tespit-bedel\.lock\.spec/);
  });
});
