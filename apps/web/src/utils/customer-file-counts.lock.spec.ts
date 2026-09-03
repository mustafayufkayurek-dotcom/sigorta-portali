/**
 * Kilit: Müşteri önizleme / liste / kart aynı sayacı okur.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/utils/customer-file-counts.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { customerFileCounts } from './customer-file-counts.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('müşteri dosya sayısı UI LOCK', () => {
  it('açık sayı yokken kapanan toplamdan hesaplanır', () => {
    assert.deepEqual(customerFileCounts({ _count: { claimFiles: 12 } }), {
      total: 12,
      open: 0,
      closed: 12,
    });
    assert.deepEqual(
      customerFileCounts({ _count: { claimFiles: 42 }, _openCount: 10, _closedCount: 32 }),
      { total: 42, open: 10, closed: 32 },
    );
  });

  it('liste hover ve detay aynı yardımcıyı kullanır', () => {
    const list = readFileSync(join(here, '../app/panel/musteriler/page.tsx'), 'utf8');
    const detail = readFileSync(join(here, '../app/panel/musteriler/[id]/page.tsx'), 'utf8');
    assert.match(list, /customerFileCounts/);
    assert.match(detail, /customerFileCounts/);
    assert.match(detail, /emergency-cases/);
  });
});
