/**
 * Karttaki yetkili ile Yetkili Kişiler aynı listedir. Kaydet ikinci kişiyi silmez.
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/customer-contacts-merge.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  mergePrimaryIntoCustomerContacts,
  shouldReplaceCustomerContacts,
} from './customer-contacts-merge.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('müşteri yetkili kişiler LOCK', () => {
  it('karttaki ad listede yoksa eklenir; ikinci kişi durur', () => {
    const merged = mergePrimaryIntoCustomerContacts(
      [{ name: 'Mustafa Softirik', role: 'Eksper' }],
      { firstName: 'Damla', lastName: 'Hanım' },
    );
    assert.equal(merged.length, 2);
    assert.equal(merged[0].name, 'Damla Hanım');
    assert.equal(merged[0].isPrimary, true);
    assert.equal(merged[1].name, 'Mustafa Softirik');
    assert.equal(merged[1].isPrimary, false);
  });

  it('aynı ad iki kez yazılmaz; ekstra kişi düşmez', () => {
    const merged = mergePrimaryIntoCustomerContacts(
      [
        { name: 'Onur İnal', role: 'Eksper' },
        { name: 'Mustafa Günsay', role: 'Dosya Sorumlusu' },
      ],
      { firstName: 'Onur', lastName: 'İnal' },
    );
    assert.equal(merged.length, 2);
    assert.equal(merged[0].name, 'Onur İnal');
    assert.equal(merged[1].name, 'Mustafa Günsay');
  });

  it('boş liste karttaki kişiyi basar; boş kayıt silme sayılmaz', () => {
    const fromCard = mergePrimaryIntoCustomerContacts([], {
      firstName: 'Melek',
      lastName: 'Yaldız',
      phone: '5320000000',
    });
    assert.equal(fromCard.length, 1);
    assert.equal(fromCard[0].name, 'Melek Yaldız');
    assert.equal(shouldReplaceCustomerContacts(fromCard), true);
    assert.equal(shouldReplaceCustomerContacts([]), false);
  });

  it('kayıt ve form karttaki adı listeye yazar; boş listeyle silmez', () => {
    const service = readFileSync(
      join(here, '../../../apps/backend/src/modules/customers/customers.service.ts'),
      'utf8',
    );
    assert.match(service, /mergePrimaryIntoCustomerContacts/);
    assert.match(service, /shouldReplaceCustomerContacts/);
    const page = readFileSync(
      join(here, '../../../apps/web/src/app/panel/musteriler/page.tsx'),
      'utf8',
    );
    assert.match(page, /mergePrimaryIntoCustomerContacts/);
    const helpers = readFileSync(
      join(here, '../../../apps/web/src/utils/customer-form-helpers.ts'),
      'utf8',
    );
    assert.match(helpers, /mergePrimaryIntoCustomerContacts/);
    const detail = readFileSync(
      join(here, '../../../apps/web/src/app/panel/musteriler/[id]/page.tsx'),
      'utf8',
    );
    assert.match(detail, /mergePrimaryIntoCustomerContacts/);
    assert.match(detail, /const contactCount = mergePrimaryIntoCustomerContacts/);
    assert.doesNotMatch(detail, /const contactCount = contacts\.length/);
  });
});
