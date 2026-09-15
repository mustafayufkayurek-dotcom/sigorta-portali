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
  filterOfficeFirmsByQuery,
  invitePeopleToSubmit,
  isCustomerCompanyUserTask,
  isInvitePersonBlank,
  isCompleteOfficePersonPhone,
  officePersonPhone,
  officePersonToFormFields,
  resolveOfficePersonPhone,
  selectedPortalOfficeCustomerId,
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

  it('davet kutusu müşteri kartında durur; Kullanıcılar ofisteki personeli listeler', () => {
    const customerPage = readFileSync(join(here, '../../musteriler/[id]/page.tsx'), 'utf8');
    assert.match(customerPage, /CustomerPortalUsersPanel/);
    const panel = readFileSync(join(here, '../../../../components/customers/CustomerPortalUsersPanel.tsx'), 'utf8');
    assert.match(panel, /Firma kullanıcıları/);
    assert.match(panel, /Kişi Ekle/);
    assert.match(panel, /placeholder="Görev"/);
    assert.match(panel, /jobTitle/);
    assert.match(panel, /Telefon zorunludur/);
    assert.doesNotMatch(panel, /Görev seçin/);
    const page = readFileSync(join(here, '../page.tsx'), 'utf8');
    assert.match(page, /eksper-ofisi-personel-listesi/);
    assert.match(page, /Bu ofiste kayıtlı personel/);
    assert.match(page, /selectOfficePerson/);
    assert.match(page, /Telefon zorunludur/);
    assert.match(page, /label="Telefon"/);
    assert.match(page, /officePersonToFormFields/);
    assert.match(page, /resolveOfficePersonPhone/);
    assert.match(page, /label: 'Eksper'/);
    assert.match(page, /Ekspertiz Firması/);
    assert.match(page, /ekspertiz-firma-secim/);
    assert.match(page, /ekspertiz-firma-secim-popup/);
    assert.match(page, /Ekspertiz firması seç/);
    assert.match(page, /sigorta-firma-secim/);
    assert.match(page, /broker-firma-secim/);
    assert.match(page, /asistans-firma-secim/);
    assert.doesNotMatch(page, /name="expert-firm"/);
    assert.doesNotMatch(page, /name="insurance-company-user-company"/);
    assert.doesNotMatch(page, /name="broker-firm"/);
    assert.doesNotMatch(page, /name="assistant-firm"/);
    assert.match(page, /portalCustomerId/);
    assert.match(page, /Kullanıcı Ekle/);
    assert.doesNotMatch(page, /Aynı müşteri firmasına birden fazla kişiyi göreviyle ekleyin/);
    assert.doesNotMatch(page, /USER_TASK_OPTIONS\.filter\(\(option\) => modal !== 'add'/);
    assert.doesNotMatch(page, /Kullanıcı Davet Et/);
    assert.doesNotMatch(page, /Sigorta, eksper, broker ve asistans kullanıcıları ilgili müşteri kartından eklenir/);
    const profil = readFileSync(join(here, '../../profil/page.tsx'), 'utf8');
    assert.match(profil, />Görev</);
    assert.match(profil, /displayPersonDuty/);
  });

  it('seçilen ekspertiz ofisi müşteri kartı kimliğidir', () => {
    assert.equal(
      selectedPortalOfficeCustomerId({ userTask: 'expert', expertCustomerId: 'ofis-1' }),
      'ofis-1',
    );
    assert.equal(
      selectedPortalOfficeCustomerId({ userTask: 'insurance_company_user', insuranceCustomerId: 'sg-1' }),
      'sg-1',
    );
    assert.equal(
      selectedPortalOfficeCustomerId({ userTask: 'broker', brokerCustomerId: 'br-1' }),
      'br-1',
    );
    assert.equal(
      selectedPortalOfficeCustomerId({ userTask: 'assistance_company_user', assistantCustomerId: 'as-1' }),
      'as-1',
    );
    assert.equal(selectedPortalOfficeCustomerId({ userTask: 'operations', expertCustomerId: 'ofis-1' }), '');
  });

  it('ekspertiz firması popup’ta ada göre süzülür', () => {
    const firms = [
      { id: '1', name: 'Andaçlar Sigorta Ekspertiz Hizmetleri' },
      { id: '2', name: 'Bağdat Eksperlik' },
      { id: '3', name: 'Meba Sigorta Ekspertizlik Hizmetleri Ltd. Şti.' },
    ];
    assert.equal(filterOfficeFirmsByQuery(firms, 'andaç').length, 1);
    assert.equal(filterOfficeFirmsByQuery(firms, 'eksper').length, 3);
    assert.equal(filterOfficeFirmsByQuery(firms, '').length, 3);
  });

  it('yazılan görev kod listesinin üstünde durur', () => {
    assert.equal(displayPersonDuty({ jobTitle: 'Hasar Müdürü', role: { code: 'expert', name: 'Expert' } }), 'Hasar Müdürü');
    assert.equal(displayPersonDuty({ jobTitle: '', role: { code: 'expert', name: 'Expert' } }), 'Eksper');
  });

  it('ofis personeli seçilince ad soyad görev e-posta telefon dolar', () => {
    const fields = officePersonToFormFields({
      firstName: 'Test',
      lastName: 'Eksper Bir',
      email: 'test.eksper.bir@meridyen-lokal.test',
      phone: '5321334144',
      jobTitle: 'Eksper',
    });
    assert.equal(fields.firstName, 'Test');
    assert.equal(fields.lastName, 'Eksper Bir');
    assert.equal(fields.email, 'test.eksper.bir@meridyen-lokal.test');
    assert.equal(fields.phone, '+905321334144');
    assert.equal(fields.jobTitle, 'Eksper');
    assert.equal(officePersonPhone('0532 133 4144'), '+905321334144');
    assert.equal(isCompleteOfficePersonPhone('+905321334144'), true);
    assert.equal(isCompleteOfficePersonPhone('+90'), false);
    assert.equal(isCompleteOfficePersonPhone(''), false);
    assert.equal(
      resolveOfficePersonPhone(
        { firstName: 'Turgut', lastName: 'Andaç', email: 'info@andaclarekspertiz.com', phone: '' },
        { contacts: [{ name: 'Turgut Andaç', email: 'info@andaclarekspertiz.com', phone: '532 133 4144' }] },
      ),
      '+905321334144',
    );
    assert.equal(
      resolveOfficePersonPhone({ firstName: 'Ayşe', lastName: 'Yılmaz', phone: '', adjuster: { phone: '05321112233' } }),
      '+905321112233',
    );
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
