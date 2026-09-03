/**
 * Günlük listelerde sütun kaydırma: sıra uygulanır, yatay kaydırma kabuğu durur.
 * Çalıştır: node --experimental-strip-types --test src/utils/panel-table-scroll.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const webSrc = join(here, '..');
const read = (rel: string) => readFileSync(join(webSrc, rel), 'utf8');

const DAILY_PAGES = [
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

function hasColumnOrder(src: string): boolean {
  return (
    src.includes('PanelOrderedHeaderRow')
    || src.includes('orderedVisibleColumns.map')
    || src.includes('visibleOpsColumns.map')
  );
}

describe('panel table scroll lock', () => {
  it('ortak kaydırma kabuğu durur', () => {
    const picker = read('components/ui/TableColumnPicker.tsx');
    assert.match(picker, /export function PanelTableScroll/);
    assert.match(picker, /min-w-0 w-full max-w-full overflow-x-auto/);
    assert.match(picker, /export function PanelOrderedHeaderRow/);
  });

  it('günlük listeler sırayı çizer ve yatay kaydırır', () => {
    for (const rel of DAILY_PAGES) {
      const src = read(rel);
      assert.ok(hasColumnOrder(src), `${rel}: sütun sırası uygulanmıyor`);
      assert.ok(
        src.includes('PanelTableScroll') || src.includes('overflow-x-auto'),
        `${rel}: yatay kaydırma kabuğu yok`,
      );
      assert.match(src, /PanelTableColGroup/, `${rel}: colgroup yok`);
    }
  });
});
