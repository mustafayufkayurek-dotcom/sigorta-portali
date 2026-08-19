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
const cases = readFileSync(
  join(specDir, '../emergency/emergency-cases.service.ts'),
  'utf8',
);

describe('acil tedarikçi öneri LOCK', () => {
  it('Acil skorlu ve ulusal fallback kapalı', () => {
    assert.match(rec, /sortBy: 'score'/);
    assert.match(rec, /allowNationalFallback: false/);
    assert.match(rec, /recommendForEmergencyCase\(caseId: string, limit = 20\)/);
    assert.match(rec, /keepAllAreaCandidates: true/);
    assert.doesNotMatch(
      rec,
      /recommendForEmergencyCase[\s\S]{0,800}sortBy: 'name'/,
    );
  });

  it('bölge boşken acil ulusal kesit öneriye düşmez', () => {
    assert.match(rec, /let city = normalizeLocationLabel/);
    assert.match(rec, /let districtName = normalizeLocationLabel/);
    assert.match(rec, /skipNational && !city && !query\.provinceId/);
    assert.match(rec, /allowNationalFallback === false/);
    assert.match(rec, /Yalnızca bu dosyada kullanım/);
  });

  it('Acil ildeki kayıtlı havuzun tamamını alır, ilçe satırı düşürmez', () => {
    assert.match(rec, /keepAllAreaCandidates \? null : districtId/);
    assert.match(rec, /resolved\.provinceName/);
  });

  it('acil API varsayılan limit 20 (ulusal 80 / 3 değil)', () => {
    assert.match(controller, /limit \? Number\(limit\) : 20/);
    assert.doesNotMatch(controller, /recommendForEmergencyCase\(\s*id,\s*limit \? Number\(limit\) : 3/);
    assert.doesNotMatch(controller, /limit \? Number\(limit\) : 80/);
  });

  it('olumsuz tedarikçi 2. çalışmada yöneticiye e-posta', () => {
    assert.match(cases, /reportNegativeVendorIfNeeded/);
    assert.match(cases, /shouldReportAcilNegativeVendorStrike/);
    assert.match(cases, /role: \{ code: \{ in: \['admin', 'ADMIN'\] \} \}/);
  });
});
