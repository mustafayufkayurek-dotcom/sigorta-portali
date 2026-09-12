/**
 * Kilit: Operasyon / Hasar kuyruğunda Sıra sütunu yok; son sütun İşlemler.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/utils/ops-list-sira.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

function lastColumnId(src: string, constName: string): string | null {
  const block = src.match(new RegExp(`const ${constName}: TableColumnDef\\[\\] = \\[([\\s\\S]*?)\\];`));
  if (!block) return null;
  const ids = [...block[1].matchAll(/id: '([^']+)'/g)].map((m) => m[1]);
  return ids.at(-1) ?? null;
}

describe('operasyon liste sıra numarası LOCK', () => {
  it('Hasar, Dosya Özeti ve Acil Yardım Dosyaları son sütunu İşlemler’dir; Sıra yok', () => {
    const hasar = readFileSync(join(here, '../app/panel/hasar-dosyalari/page.tsx'), 'utf8');
    const ops = readFileSync(join(here, '../app/panel/operasyon/page.tsx'), 'utf8');
    const acilYardim = readFileSync(join(here, '../app/panel/acil-yardim/page.tsx'), 'utf8');
    assert.equal(lastColumnId(hasar, 'TABLE_COLUMNS'), 'actions');
    assert.equal(lastColumnId(ops, 'TABLE_COLUMNS'), 'actions');
    assert.equal(lastColumnId(ops, 'ACIL_TABLE_COLUMNS'), 'actions');
    assert.match(hasar, /table-cols:hasar-dosyalari-v10/);
    assert.match(ops, /table-cols:operasyon-all-v14/);
    assert.match(ops, /table-cols:operasyon-hasar-v14/);
    assert.match(ops, /table-cols:operasyon-acil-v19/);
    assert.match(ops, /Acil Yardım Dosyaları/);
    assert.match(acilYardim, /filter', 'acil'/);
    assert.match(acilYardim, /\/panel\/operasyon/);
    assert.doesNotMatch(hasar, /id: 'sira'/);
    assert.doesNotMatch(ops, /id: 'sira'/);
    assert.doesNotMatch(acilYardim, /id: 'sira'/);
    assert.doesNotMatch(hasar, /opsListRowNumber/);
    assert.doesNotMatch(ops, /opsListRowNumber/);
  });
});
