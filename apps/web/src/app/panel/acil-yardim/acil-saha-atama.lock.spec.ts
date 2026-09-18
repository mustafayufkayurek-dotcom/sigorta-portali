/**
 * Acil dosya sorumlusu saha operasyonunu seçer.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/app/panel/acil-yardim/acil-saha-atama.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

describe('acil saha atama UI LOCK', () => {
  it('Acil dosyada Saha Operasyonu durur; tedarikçiyle karışmaz', () => {
    const page = readFileSync(join(here, '[id]/page.tsx'), 'utf8');
    assert.match(page, /AcilSahaAssignCard/);
    const vendorStep = page.slice(page.indexOf('vendorStep='), page.indexOf('approvalStep='));
    assert.match(vendorStep, /AcilSahaAssignCard/);
    const card = readFileSync(join(here, '../../../components/field-survey/AcilSahaAssignCard.tsx'), 'utf8');
    assert.match(card, /acil-saha-atama/);
    assert.match(card, /Saha Operasyonu/);
    assert.match(card, /assignable-staff\?role=field_staff/);
    assert.match(card, /assignedFieldUserId/);
    assert.doesNotMatch(card, /Tespitçi Tedarikçi/);
    assert.doesNotMatch(card, /Google|Places/);
  });
});
