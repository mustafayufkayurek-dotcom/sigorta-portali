/**
 * Kilit: Acil tedarikçi önerisi il/ilçe + skor; ulusal kesit yok.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/modules/vendors/acil-supplier-recommendation.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const specDir = dirname(fileURLToPath(import.meta.url));
const rec = readFileSync(join(specDir, 'vendor-recommendation.service.ts'), 'utf8');
const controller = readFileSync(
  join(specDir, '../emergency/emergency-cases.controller.ts'),
  'utf8',
);

describe('acil tedarikçi öneri LOCK', () => {
  it('Acil skorlu ve ulusal fallback kapalı', () => {
    assert.match(rec, /sortBy: 'score'/);
    assert.match(rec, /allowNationalFallback: false/);
    assert.match(rec, /recommendForEmergencyCase\(caseId: string, limit = 8\)/);
    assert.doesNotMatch(
      rec,
      /recommendForEmergencyCase[\s\S]{0,800}sortBy: 'name'/,
    );
  });

  it('bölge boşken acil ulusal kesit öneriye düşmez', () => {
    assert.match(rec, /skipNational && !city && !query\.provinceId/);
    assert.match(rec, /allowNationalFallback === false/);
    assert.match(rec, /Yalnızca bu dosyada kullanım/);
  });

  it('acil API varsayılan limit 8 (ulusal 80 / 3 değil)', () => {
    assert.match(controller, /limit \? Number\(limit\) : 8/);
    assert.doesNotMatch(controller, /recommendForEmergencyCase\(\s*id,\s*limit \? Number\(limit\) : 3/);
    assert.doesNotMatch(controller, /limit \? Number\(limit\) : 80/);
  });
});
