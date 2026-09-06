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
});
