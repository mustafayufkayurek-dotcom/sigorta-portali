/**
 * Sigorta Ayarlar kaydıdır; müşteri kartı değildir.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/modules/customers/insurance-catalog-bind.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

describe('sigorta Ayarlar kapısı kilidi', () => {
  it('sigorta müşteri kartı açılır', () => {
    const service = readFileSync(join(here, 'customers.service.ts'), 'utf8');
    assert.doesNotMatch(service, /Sigorta şirketi Ayarlar’dan kaydedilir/);
    const picker = readFileSync(
      join(here, '../../../../../apps/web/src/utils/customer-form-helpers.ts'),
      'utf8',
    );
    assert.doesNotMatch(picker, /if \(t\.value === 'sigorta_sirketi'\) return false/);
  });

  it('portal daveti karttan değil Ayarlar şirketinden gider', () => {
    const users = readFileSync(join(here, '../users/users.service.ts'), 'utf8');
    assert.match(users, /Sigorta kullanıcısı Kullanıcılar’dan, Ayarlar’daki şirkete eklenir/);
    assert.match(users, /userInsuranceCompanyScopes: \{ some: \{ insuranceCompanyId \} \}/);
    const page = readFileSync(
      join(here, '../../../../../apps/web/src/app/panel/kullanicilar/page.tsx'),
      'utf8',
    );
    assert.match(page, /payload\.insuranceCompanyIds = \[form\.insuranceCustomerId\]/);
    assert.match(page, /musterilerHref: '\/panel\/ayarlar\/sigorta-sirketleri'/);
    assert.doesNotMatch(page, /isLinkedInsurancePortalCustomer/);
  });

  it('Ayarlar satırında Kart Aç yok', () => {
    const settings = readFileSync(
      join(here, '../../../../../apps/web/src/app/panel/ayarlar/sigorta-sirketleri/page.tsx'),
      'utf8',
    );
    assert.doesNotMatch(settings, /Kartı Aç/);
    assert.doesNotMatch(settings, /Kart Aç/);
    const customersPage = readFileSync(
      join(here, '../../../../../apps/web/src/app/panel/musteriler/page.tsx'),
      'utf8',
    );
    assert.doesNotMatch(customersPage, /Dosya kapsamı/);
  });
});
