/**
 * Kaynak dosya kilidi — onaylı tedarikçi/görev sözleşmesi sessizce bozulmasın.
 * Çalıştır: npx tsx --test src/utils/hasar-tedarikci-roundtrip.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { buildSupplierTaskMapFromNotes } from './hasar-supplier-tasks';
import { resolveClaimSupplierDisplayName } from './claim-supplier-display';

const webRoot = join(__dirname, '..');

function readWeb(rel: string): string {
  return readFileSync(join(webRoot, rel), 'utf8');
}

describe('hasar-tedarikci-roundtrip LOCK', () => {
  it('liste UI tedarikçi için resolveClaimSupplierDisplayName kullanır; assignedAdjuster ile üretmez', () => {
    const page = readWeb('app/panel/hasar-dosyalari/page.tsx');
    assert.match(page, /resolveClaimSupplierDisplayName/);
    assert.doesNotMatch(
      page,
      /const supplierName\s*=\s*claim\.assignedAdjuster/,
      'Tedarikçi sütunu tekrar assignedAdjuster okumamalı',
    );
    assert.doesNotMatch(
      page,
      /case 'supplier':[\s\S]{0,200}assignedAdjuster/,
      'Sıralama supplier alanı assignedAdjuster kullanmamalı',
    );
  });

  it('planlayıcı görev map’i note’tan üretilir', () => {
    const map = buildSupplierTaskMapFromNotes([
      { id: 'v1', note: '  Mutfak tamiri  ' },
      { id: 'v2', note: '' },
      { id: 'v3', note: null },
    ]);
    assert.deepEqual(map, { v1: 'Mutfak tamiri' });
  });

  it('liste helper eksper adını tedarikçi saymaz', () => {
    assert.equal(
      resolveClaimSupplierDisplayName({
        assignedSupplier: { name: 'Şükrü Öztürk' },
      }),
      'Şükrü Öztürk',
    );
  });

  it('planner hydrate buildSupplierTaskMapFromNotes kullanır', () => {
    const ctx = readWeb('components/hasar-operasyon-planlayicisi/planner-context.tsx');
    assert.match(ctx, /buildSupplierTaskMapFromNotes/);
    assert.match(ctx, /supplierNotes/);
  });

  it('claim-snapshot assigned supplier note taşır', () => {
    const snap = readWeb('components/hasar-operasyon-planlayicisi/claim-snapshot.ts');
    assert.match(snap, /note:\s*typeof s\.note === 'string'/);
  });
});
