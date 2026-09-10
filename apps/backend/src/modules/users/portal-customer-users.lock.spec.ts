/**
 * Portal kullanıcıları müşteri kartından açılır.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/modules/users/portal-customer-users.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  isPortalCustomerSubType,
  roleCodesForPortalCustomerSubType,
} from './portal-customer-subtypes.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('müşteri kartı portal kullanıcısı LOCK', () => {
  it('yalnız sigorta eksper broker asistans kartında portal kullanıcısı açılır', () => {
    assert.equal(isPortalCustomerSubType('sigorta_sirketi'), true);
    assert.equal(isPortalCustomerSubType('eksper_firmasi'), true);
    assert.equal(isPortalCustomerSubType('broker_firmasi'), true);
    assert.equal(isPortalCustomerSubType('asistan_firmasi'), true);
    assert.equal(isPortalCustomerSubType('insured'), false);
    assert.equal(isPortalCustomerSubType('private_customer'), false);
  });

  it('kart tipi sistem rolünü belirler, görev kod listesi değildir', () => {
    assert.deepEqual(roleCodesForPortalCustomerSubType('eksper_firmasi'), ['expert', 'adjuster']);
    assert.deepEqual(roleCodesForPortalCustomerSubType('sigorta_sirketi'), ['insurance_company_user']);
    assert.deepEqual(roleCodesForPortalCustomerSubType('broker_firmasi'), ['broker_user', 'broker']);
    assert.deepEqual(roleCodesForPortalCustomerSubType('asistan_firmasi'), ['assistance_company_user']);
  });

  it('davet müşteri kartından gider; Kullanıcılar eklemede dış firma seçilmez', () => {
    const controller = readFileSync(join(here, 'users.controller.ts'), 'utf8');
    assert.match(controller, /portal-invite\/:customerId/);
    const usersPage = readFileSync(join(here, '../../../../web/src/app/panel/kullanicilar/page.tsx'), 'utf8');
    assert.match(usersPage, /modal !== 'add' \|\| !isCustomerCompanyUserTask/);
    const customerPage = readFileSync(join(here, '../../../../web/src/app/panel/musteriler/[id]/page.tsx'), 'utf8');
    assert.match(customerPage, /CustomerPortalUsersPanel/);
    const panel = readFileSync(join(here, '../../../../web/src/components/customers/CustomerPortalUsersPanel.tsx'), 'utf8');
    assert.match(panel, /Firma kullanıcıları/);
    assert.match(panel, /placeholder="Görev"/);
    assert.match(panel, /portal-invite/);
    assert.doesNotMatch(panel, /Görev seçin/);
  });
});
