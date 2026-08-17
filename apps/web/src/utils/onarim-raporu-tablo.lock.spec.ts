/**
 * Onarım raporu kalem tablosu — sade hücre düzeni kilidi.
 * Grup şerit satırları (Tespit:/Mahal:/İş Grubu:) onaylı sade tabloyu bozar.
 *
 * Çalıştır: npx tsx --test src/utils/onarim-raporu-tablo.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const webRoot = join(__dirname, '..');

function readPage(): string {
  return readFileSync(
    join(webRoot, 'app/panel/hasar-dosyalari/[id]/onarim-raporu/[reportId]/page.tsx'),
    'utf8',
  );
}

describe('onarim-raporu-tablo LOCK (sade tablo)', () => {
  it('grup şerit anahtarları yok (g-scope / g-loc / g-wg)', () => {
    const page = readPage();
    assert.doesNotMatch(page, /g-scope-/);
    assert.doesNotMatch(page, /g-loc-/);
    assert.doesNotMatch(page, /g-wg-/);
  });

  it('colSpan ile Tespit:/Mahal/Bölge:/İş Grubu: şerit metni yok', () => {
    const page = readPage();
    assert.doesNotMatch(page, /Tespit:\s*\{scopeLabel\}/);
    assert.doesNotMatch(page, /Mahal\/Bölge:\s*\{locLabel\}/);
    assert.doesNotMatch(page, /İş Grubu:\s*\{wgLabel\}/);
    assert.doesNotMatch(page, /headerNodes/);
  });

  it('kalem gövdesi displayRows.map ile sade satır üretir (flatMap grup birleştirmez)', () => {
    const page = readPage();
    assert.match(page, /displayRows\.map\(\(row,\s*rowIdx\)\s*=>/);
    assert.doesNotMatch(
      page,
      /displayRows\.flatMap\(\(row,\s*rowIdx\)\s*=>/,
      'flatMap geri gelirse grup şerit birleştirme riski yeniden açılır',
    );
  });

  it('kilit işaretçisi kaynakta durur', () => {
    const page = readPage();
    assert.match(page, /ONARIM_TABLO_SADE_KILIT/);
  });

  it('sütun başlıkları ortalı ve resize tutamacı vardır', () => {
    const page = readPage();
    assert.match(page, /KalemColResizeHandle/);
    assert.match(page, /table-fixed/);
    assert.match(page, /KALEM_COL_WIDTHS_KEY/);
    // sayısal başlıklar da ortalı (text-right yasak thead kalem tablosunda)
    assert.match(page, /const thCls =/);
  });
});
