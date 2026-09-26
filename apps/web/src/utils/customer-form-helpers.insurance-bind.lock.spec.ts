/**
 * Kurumsal müşteri tipinde Sigorta Şirketi durur (canlı form).
 * Çalıştır: node --experimental-strip-types --test apps/web/src/utils/customer-form-helpers.insurance-bind.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

describe('sigorta müşteri tipi kilidi', () => {
  it('kurumsal yeni kayıtta Sigorta Şirketi seçilir', () => {
    const helper = readFileSync(join(here, 'customer-form-helpers.ts'), 'utf8');
    assert.doesNotMatch(helper, /if \(t\.value === 'sigorta_sirketi'\) return false/);
    assert.match(helper, /value: 'sigorta_sirketi', label: 'Sigorta Şirketi'/);
    const page = readFileSync(join(here, '../app/panel/musteriler/page.tsx'), 'utf8');
    assert.match(page, /value: 'sigorta_sirketi', label: 'Sigorta Şirketi'/);
    assert.doesNotMatch(page, /t\.value !== 'sigorta_sirketi'/);
  });

  it('müşteri formunda kapsam kutusu durmaz', () => {
    const page = readFileSync(join(here, '../app/panel/musteriler/page.tsx'), 'utf8');
    assert.doesNotMatch(page, /Dosya kapsamı/);
    assert.doesNotMatch(page, /matchInsuranceCatalogCompany/);
  });
});
