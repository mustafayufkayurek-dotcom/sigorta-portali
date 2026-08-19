/**
 * Bölge eşlemesi — Afyon / Kartepe hizmet bölgesi.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/modules/claim-files/vendor-area-match.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const util = readFileSync(join(here, 'vendor-area-match.util.ts'), 'utf8');
const rec = readFileSync(
  join(here, '../vendors/vendor-recommendation.service.ts'),
  'utf8',
);

describe('vendor area match LOCK', () => {
  it('Afyon alias ve hizmet bölgesi adı çözülmeden ulusal kesite düşmez', () => {
    assert.match(util, /splitCombinedLocation/);
    assert.match(util, /locationNameVariants/);
    assert.match(util, /provinceSearchNames/);
    assert.match(util, /serviceAreas: \{ some: \{ province: \{ name: nameEquals\(name\) \} \} \}/);
    assert.match(util, /serviceAreas: \{ some: \{ district: \{ name: nameEquals\(name\) \} \} \}/);
  });

  it('Acil il havuzunda ilçe satırı adayı düşürmez', () => {
    assert.match(rec, /keepAllAreaCandidates \? null : districtId/);
    assert.match(rec, /resolved\.provinceName/);
  });
});
