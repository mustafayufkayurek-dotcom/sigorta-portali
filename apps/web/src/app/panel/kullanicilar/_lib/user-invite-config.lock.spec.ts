/**
 * Müşteri firmasında çoklu kullanıcı daveti.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/app/panel/kullanicilar/_lib/user-invite-config.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  displayPersonDuty,
  emptyInvitePersonDraft,
  invitePeopleToSubmit,
  isCustomerCompanyUserTask,
  isInvitePersonBlank,
  showsUserOperationalAuthorization,
} from './user-invite-config.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('müşteri firması çoklu davet LOCK', () => {
  it('sigorta, eksper, broker ve asistans müşteri firması davetidir', () => {
    assert.equal(isCustomerCompanyUserTask('expert'), true);
    assert.equal(isCustomerCompanyUserTask('insurance_company_user'), true);
    assert.equal(isCustomerCompanyUserTask('broker'), true);
    assert.equal(isCustomerCompanyUserTask('assistance_company_user'), true);
    assert.equal(isCustomerCompanyUserTask('operations'), false);
    assert.equal(isCustomerCompanyUserTask('management'), false);
  });

  it('boş fazla satır düşer; en az bir kişi kalır', () => {
    const a = emptyInvitePersonDraft();
    const b = emptyInvitePersonDraft();
    a.firstName = 'Ayşe';
    a.lastName = 'Yılmaz';
    a.email = 'ayse@firma.com';
    assert.equal(isInvitePersonBlank(b), true);
    const submit = invitePeopleToSubmit([a, b]);
    assert.equal(submit.length, 1);
    assert.equal(submit[0]?.email, 'ayse@firma.com');
    assert.equal(invitePeopleToSubmit([emptyInvitePersonDraft()]).length, 1);
  });

  it('davet kutusu aynı firmaya birden fazla kişiyi göreviyle ekler', () => {
    const customerPage = readFileSync(join(here, '../../musteriler/[id]/page.tsx'), 'utf8');
    assert.match(customerPage, /CustomerPortalUsersPanel/);
    const panel = readFileSync(join(here, '../../../../components/customers/CustomerPortalUsersPanel.tsx'), 'utf8');
    assert.match(panel, /Firma kullanıcıları/);
    assert.match(panel, /Kişi Ekle/);
    assert.match(panel, /placeholder="Görev"/);
    assert.match(panel, /jobTitle/);
    assert.doesNotMatch(panel, /Görev seçin/);
    const page = readFileSync(join(here, '../page.tsx'), 'utf8');
    assert.match(page, /modal !== 'add' \|\| !isCustomerCompanyUserTask/);
    const profil = readFileSync(join(here, '../../profil/page.tsx'), 'utf8');
    assert.match(profil, />Görev</);
    assert.match(profil, /displayPersonDuty/);
  });

  it('yazılan görev kod listesinin üstünde durur', () => {
    assert.equal(displayPersonDuty({ jobTitle: 'Hasar Müdürü', role: { code: 'expert', name: 'Expert' } }), 'Hasar Müdürü');
    assert.equal(displayPersonDuty({ jobTitle: '', role: { code: 'expert', name: 'Expert' } }), 'Eksper');
  });

  it('yetkilendirme yalnız Meridyen dosya sorumlusunda sorulur', () => {
    assert.equal(showsUserOperationalAuthorization('operations', 'admin'), true);
    assert.equal(showsUserOperationalAuthorization('', 'office_staff'), true);
    assert.equal(showsUserOperationalAuthorization('management', 'office_staff'), false);
    assert.equal(showsUserOperationalAuthorization('field_operations', 'field_staff'), false);
    assert.equal(showsUserOperationalAuthorization('expert', 'expert'), false);
    assert.equal(showsUserOperationalAuthorization('finance', 'finance'), false);
    const page = readFileSync(join(here, '../page.tsx'), 'utf8');
    assert.match(page, /showsUserOperationalAuthorization\(form\.userTask/);
    const detail = readFileSync(join(here, '../[id]/page.tsx'), 'utf8');
    assert.match(detail, /showsUserOperationalAuthorization\(undefined, user\.role\?\.code\)/);
  });
});
