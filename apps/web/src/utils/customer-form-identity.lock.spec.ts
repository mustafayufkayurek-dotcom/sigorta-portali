/**
 * Müşteri form kimlik bandı ve tip uyarısı.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/utils/customer-form-identity.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

describe('müşteri form kimlik bandı LOCK', () => {
  it('adı yazılınca eksper uyarısı kalkar; üst bant kısa adı basar', () => {
    const helpers = readFileSync(join(here, 'customer-form-helpers.ts'), 'utf8');
    assert.match(helpers, /customerSubTypeHintForForm/);
    assert.match(helpers, /customerFormHasIdentity/);
    assert.match(helpers, /customerFormIdentityBand/);
    assert.match(helpers, /if \(customerFormHasIdentity\(form\)\) return null/);
    assert.match(helpers, /Eksper firması bilgilerini giriniz/);
  });

  it('müşteri tedarikçi personel formunda kimlik bandı durur', () => {
    const musteriler = readFileSync(join(here, '../app/panel/musteriler/page.tsx'), 'utf8');
    assert.match(musteriler, /musteri-form-kimlik-bandi/);
    assert.match(musteriler, /from-emerald-600/);
    assert.match(musteriler, /identityFilled=\{customerFormHasIdentity\(form\)\}/);
    const tedarik = readFileSync(join(here, '../app/panel/tedarikciler/page.tsx'), 'utf8');
    assert.match(tedarik, /tedarikci-form-kimlik-bandi/);
    assert.match(tedarik, /from-indigo-600/);
    const personel = readFileSync(join(here, '../components/hr/PersonelEklePanel.tsx'), 'utf8');
    assert.match(personel, /personel-form-kimlik-bandi/);
    assert.match(personel, /from-emerald-600/);
  });
});
