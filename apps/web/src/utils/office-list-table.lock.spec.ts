/**
 * Ofis günlük listesi tablo yüzüdür; daralınca kart liste açılmaz.
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

const OFIS_LISTE_SAYFALARI = [
  'app/panel/hasar-dosyalari/page.tsx',
  'app/panel/operasyon/page.tsx',
  'app/panel/musteriler/page.tsx',
  'app/panel/tedarikciler/page.tsx',
  'app/panel/kullanicilar/page.tsx',
  'app/panel/carilerim/page.tsx',
  'app/panel/finans/tahsilatlar/page.tsx',
  'app/panel/finans/masraflar/page.tsx',
  'app/panel/finans/kdv-raporu/page.tsx',
  'app/panel/acil-yardim/finans/page.tsx',
  'app/panel/finans/portfolyo-pl/page.tsx',
  'app/panel/finans/dosya-pl/page.tsx',
  'app/panel/finans/banka-hesaplari/page.tsx',
  'app/panel/raporlar/dosya-performansi/page.tsx',
  'app/panel/raporlar/brans-analizi/page.tsx',
  'app/panel/raporlar/finansal/page.tsx',
  'app/panel/raporlar/personel-performansi/page.tsx',
  'app/panel/raporlar/sla/page.tsx',
  'app/panel/raporlar/eksper/page.tsx',
  'app/panel/sahiplik/page.tsx',
  'app/panel/revizyon-talepleri/page.tsx',
] as const;

describe('ofis liste tablo LOCK', () => {
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

  it('Müşteriler ofiste tablo durur; dar kart kapalı', () => {
    const page = read('app/panel/musteriler/page.tsx');
    assert.match(page, /musteri-ofis-tablo/);
    assert.match(page, /musteri-dar-kart-liste-kapali/);
    assert.doesNotMatch(page, /grid gap-3 p-3 lg:hidden/);
    assert.doesNotMatch(page, /PanelTableScroll className="hidden lg:block"/);
  });

  it('Tedarikçiler ofiste tablo durur; dar kart kapalı', () => {
    const page = read('app/panel/tedarikciler/page.tsx');
    assert.match(page, /tedarikci-ofis-tablo/);
    assert.match(page, /tedarikci-dar-kart-liste-kapali/);
    assert.doesNotMatch(page, /Mobil kart listesi/);
    assert.doesNotMatch(page, /ops-queue-table hidden md:block/);
  });

  it('ofis günlük listesinde daralınca kart yüzü açılmaz', () => {
    for (const rel of OFIS_LISTE_SAYFALARI) {
      const src = read(rel);
      assert.doesNotMatch(src, /grid gap-3 p-3 lg:hidden/, `${rel}: dar kart yüzü`);
      assert.doesNotMatch(src, /PanelTableScroll className="hidden lg:block"/, `${rel}: tablo gizlenir`);
      assert.doesNotMatch(src, /ops-queue-table hidden md:block/, `${rel}: tablo daraltınca kapanır`);
    }
  });
});
