/**
 * Kilit: Operasyon / Hasar kuyruğunun son sütunu Sıra’dır.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/utils/ops-list-sira.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { opsListRowNumber } from './ops-list-sira.ts';

const here = dirname(fileURLToPath(import.meta.url));

function lastColumnId(src: string, constName: string): string | null {
  const block = src.match(new RegExp(`const ${constName}: TableColumnDef\\[\\] = \\[([\\s\\S]*?)\\];`));
  if (!block) return null;
  const ids = [...block[1].matchAll(/id: '([^']+)'/g)].map((m) => m[1]);
  return ids.at(-1) ?? null;
}

describe('operasyon liste sıra numarası LOCK', () => {
  it('sayfa ve satırdan 1 tabanlı numara üretir', () => {
    assert.equal(opsListRowNumber(1, 20, 0), 1);
    assert.equal(opsListRowNumber(2, 20, 0), 21);
    assert.equal(opsListRowNumber(3, 50, 4), 105);
  });

  it('Hasar ve Operasyon tablolarının son sütunu Sıra’dır', () => {
    const hasar = readFileSync(join(here, '../app/panel/hasar-dosyalari/page.tsx'), 'utf8');
    const ops = readFileSync(join(here, '../app/panel/operasyon/page.tsx'), 'utf8');
    assert.equal(lastColumnId(hasar, 'TABLE_COLUMNS'), 'sira');
    assert.equal(lastColumnId(ops, 'TABLE_COLUMNS'), 'sira');
    assert.equal(lastColumnId(ops, 'ACIL_TABLE_COLUMNS'), 'sira');
    assert.match(hasar, /table-cols:hasar-dosyalari-v9/);
    assert.match(ops, /table-cols:operasyon-all-v13/);
    assert.match(ops, /table-cols:operasyon-hasar-v13/);
    assert.match(ops, /table-cols:operasyon-acil-v18/);
    assert.match(hasar, /opsListRowNumber/);
    assert.match(ops, /opsListRowNumber/);
    assert.match(hasar, /colId="sira"/);
    assert.match(ops, /case 'sira'/);
  });
});
