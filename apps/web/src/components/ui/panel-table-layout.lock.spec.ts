/**
 * Tablo sütunları ekrana göre şişip daralmaz.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/components/ui/panel-table-layout.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const picker = readFileSync(join(here, 'TableColumnPicker.tsx'), 'utf8');

describe('panel tablo genişlik kilidi', () => {
  it('tablo kartı doldurur; sütun toplamından daralmaz', () => {
    assert.match(picker, /tableLayout: 'fixed'/);
    assert.match(picker, /width: '100%'/);
    assert.match(picker, /minWidth: `\$\{totalPx\}px`/);
    assert.doesNotMatch(picker, /width: `\$\{totalPx\}px`/);
  });

  it('colgroup her sütuna genişlik yazar; flex boş bırakmaz', () => {
    assert.match(picker, /style=\{\{ width: ctx\.widths\.getWidth\(col\.id\) \}\}/);
    assert.doesNotMatch(picker, /col\.flex \? undefined/);
  });

  it('Sütunlar ve İşlemler yan yana durur', () => {
    assert.match(picker, /export function PanelListToolbarPickers/);
    assert.match(picker, /flex flex-nowrap items-center justify-end gap-2/);
    const hasar = readFileSync(join(here, '../../app/panel/hasar-dosyalari/page.tsx'), 'utf8');
    assert.match(hasar, /PanelListToolbarPickers/);
    assert.doesNotMatch(hasar, /w-full flex-shrink-0 sm:ml-auto sm:w-auto/);
    const faturalar = readFileSync(join(here, '../../app/panel/finans/faturalar/page.tsx'), 'utf8');
    const tahsilat = readFileSync(join(here, '../../app/panel/finans/tahsilatlar/page.tsx'), 'utf8');
    const talepler = readFileSync(join(here, '../../components/finance/FaturaTalepleriSection.tsx'), 'utf8');
    assert.match(faturalar, /PanelListToolbarPickers/);
    assert.match(tahsilat, /PanelListToolbarPickers/);
    assert.match(talepler, /PanelListToolbarPickers/);
    assert.match(talepler, /PanelTableColGroup/);
    assert.match(talepler, /PortalRowActionsPicker/);
    const masraflar = readFileSync(join(here, '../../app/panel/finans/masraflar/page.tsx'), 'utf8');
    const cariler = readFileSync(join(here, '../../app/panel/carilerim/page.tsx'), 'utf8');
    assert.match(masraflar, /PortalRowActionsPicker/);
    assert.match(cariler, /PortalRowActionsPicker/);
  });

  it('başlık ilk harfi kesilmez; tutamaç sonraki sütuna binmez', () => {
    assert.match(picker, /overflow-visible !text-center/);
    assert.match(picker, /whitespace-nowrap px-2 pr-3/);
    assert.doesNotMatch(picker, /overflow-hidden !text-center/);
    assert.doesNotMatch(picker, /-right-0\.5/);
    assert.match(picker, /truncate whitespace-nowrap/);
  });

  it('KDV raporu tutar biçimini import eder', () => {
    const kdv = readFileSync(join(here, '../../app/panel/finans/kdv-raporu/page.tsx'), 'utf8');
    assert.match(kdv, /import \{ formatTryAmount \} from '@\/utils\/format-try-amount'/);
    assert.match(kdv, /return formatTryAmount\(n, \{ fractionDigits: 2 \}\)/);
  });

  it('finans listeleri tabloyu ekrana yüzdeyle yaymaz', () => {
    const pages = [
      '../../app/panel/finans/banka-hesaplari/page.tsx',
      '../../app/panel/finans/karlilik/page.tsx',
      '../../app/panel/finans/portfolyo-pl/page.tsx',
      '../../app/panel/finans/dosya-pl/page.tsx',
      '../../app/panel/acil-yardim/finans/page.tsx',
      '../../app/panel/finans/faturalar/page.tsx',
      '../../app/panel/finans/tahsilatlar/page.tsx',
      '../../app/panel/finans/masraflar/page.tsx',
      '../../app/panel/finans/kdv-raporu/page.tsx',
      '../../app/panel/carilerim/page.tsx',
    ];
    for (const rel of pages) {
      const src = readFileSync(join(here, rel), 'utf8');
      assert.doesNotMatch(
        src,
        /className="w-full text-sm"\s+style=\{panelTableLayoutStyle/,
        rel,
      );
    }
  });

  it('Kullanıcılar listesi Hasar süzgeci ve tablo kabuğunu kullanır; boş telefon sütunu yok', () => {
    const users = readFileSync(join(here, '../../app/panel/kullanicilar/page.tsx'), 'utf8');
    assert.match(users, /filter-bar/);
    assert.match(users, /panel-filter-bar/);
    assert.match(users, /table-container/);
    assert.match(users, /TABLE_LEADING_COL_WIDTH = 36/);
    assert.match(users, /table-th !text-left/);
    assert.match(users, /formatPhoneDisplay\(u\.phone\)/);
    assert.doesNotMatch(users, /id: 'phone', label: 'Telefon'/);
    assert.doesNotMatch(users, /sm:ml-auto/);
    assert.match(users, /className="w-full text-sm"/);
    assert.match(users, /Kişi Ekle/);
    assert.match(users, /invitePeople/);
  });
});
