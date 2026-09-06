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
  it('tablo genişliği yüzde değil, sütun toplamı pikseldir', () => {
    assert.match(picker, /tableLayout: 'fixed'/);
    assert.match(picker, /width: `\$\{totalPx\}px`/);
    assert.match(picker, /minWidth: `\$\{totalPx\}px`/);
    assert.doesNotMatch(picker, /width: '100%'/);
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
});
