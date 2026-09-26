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
  fieldStaffIncludesAcil,
  fieldStaffUsesServiceBranches,
  showsUserOperationalAuthorization,
  showsMeridyenWorkHoursToggle,
  userInviteCardTitle,
  acilYardimAssistantCustomerName,
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
    assert.match(page, /OrganizationSelectList/);
    assert.match(page, /\$\{testId\}-popup/);
    assert.match(page, /Ekspertiz firması seç/);
    assert.doesNotMatch(page, /FirmPickerOverlay/);
    assert.match(page, /sigorta-firma-secim/);
    assert.match(page, /broker-firma-secim/);
    assert.match(page, /asistans-firma-secim/);
    assert.doesNotMatch(page, /name="expert-firm"/);
    assert.doesNotMatch(page, /name="insurance-company-user-company"/);
    assert.doesNotMatch(page, /name="broker-firm"/);
    assert.doesNotMatch(page, /name="assistant-firm"/);
    assert.match(page, /portalCustomerId/);
    assert.match(page, /SearchableSelect/);
    assert.match(page, /disableBrowserAutocomplete/);
    assert.match(page, /Şirket adı yazın/);
    assert.doesNotMatch(page, /Firma nereye yazılır/);
    assert.doesNotMatch(page, /Kişi Ayarlar’daki sigorta şirketine bağlanır/);
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
    assert.equal(showsUserOperationalAuthorization('finance', 'finance'), true);
    assert.equal(fieldStaffIncludesAcil('acil'), true);
    assert.equal(fieldStaffIncludesAcil('both'), true);
    assert.equal(fieldStaffIncludesAcil('hasar'), false);
    assert.equal(fieldStaffUsesServiceBranches('hasar'), false);
    assert.equal(fieldStaffUsesServiceBranches('acil'), false);
    assert.equal(fieldStaffUsesServiceBranches('both'), false);
    const page = readFileSync(join(here, '../page.tsx'), 'utf8');
    assert.match(page, /Her İkisi/);
    assert.match(page, /FIELD_OPERATION_AREA_OPTIONS/);
    assert.match(page, /sm:grid-cols-3/);
    assert.match(page, /fieldStaffUsesServiceBranches/);
    assert.match(page, /Hasar ve Acil’de hizmet kolu aranmaz/);
    assert.doesNotMatch(page, /Acil Yardım — Hizmet Kolları/);
    assert.match(page, /showsUserOperationalAuthorization\(form\.userTask/);
    const detail = readFileSync(join(here, '../[id]/page.tsx'), 'utf8');
    assert.match(detail, /showsUserOperationalAuthorization\(undefined, user\.role\?\.code\)/);
  });

  it('Finans ile Eksper yer değiştirmiştir', () => {
    const page = readFileSync(join(here, '../page.tsx'), 'utf8');
    const tasks = page.slice(
      page.indexOf('const USER_TASK_OPTIONS'),
      page.indexOf('const OPERATION_AREA_OPTIONS'),
    );
    assert.ok(
      tasks.indexOf("value: 'finance'") >= 0
      && tasks.indexOf("value: 'finance'") < tasks.indexOf("value: 'expert'"),
      'Finans Eksper satırındadır',
    );
  });

  it('mesai kısıtı düğmesi yalnız Meridyen personelinde durur', () => {
    assert.equal(showsMeridyenWorkHoursToggle('finance', 'finance'), true);
    assert.equal(showsMeridyenWorkHoursToggle('operations', 'office_staff'), true);
    assert.equal(showsMeridyenWorkHoursToggle('management', 'admin'), true);
    assert.equal(showsMeridyenWorkHoursToggle('field_operations', 'field_staff'), true);
    assert.equal(showsMeridyenWorkHoursToggle('expert', 'expert'), false);
    assert.equal(showsMeridyenWorkHoursToggle('insurance_company_user', 'insurance_company_user'), false);
    assert.equal(showsMeridyenWorkHoursToggle('', 'finance'), true);
    const page = readFileSync(join(here, '../page.tsx'), 'utf8');
    assert.match(page, /WorkHoursGateToggle/);
    assert.match(page, /showsMeridyenWorkHoursToggle/);
    assert.match(page, /payload\.workHoursRestricted = form\.workHoursRestricted === true/);
    assert.match(page, /label="Kullanıcı Türü"/);
    assert.doesNotMatch(page, /Bu kişi kim/);
    const toggle = readFileSync(join(here, '../../../../components/users/WorkHoursGateToggle.tsx'), 'utf8');
    assert.match(toggle, /Mesai Saati Kısıtı/);
    assert.match(toggle, /userId\?: string/);
    const detail = readFileSync(join(here, '../[id]/page.tsx'), 'utf8');
    assert.match(detail, /WorkHoursGateToggle/);
  });

  it('acil yardım müşteri adı kısa ünvanı da okur', () => {
    assert.equal(
      acilYardimAssistantCustomerName({
        id: '1',
        companyName: null,
        fullName: null,
        shortName: 'Turasist',
      }),
      'Turasist',
    );
    const source = readFileSync(join(here, './user-invite-config.ts'), 'utf8');
    assert.match(source, /ACIL_YARDIM_ASSISTANT_CUSTOMER_SUB_TYPE = 'asistan_firmasi'/);
    const seed = readFileSync(
      join(here, '../../../../../../backend/prisma/seed.ts'),
      'utf8',
    );
    assert.match(seed, /Tur-Assist/);
    assert.match(seed, /Marm Assistance/);
    assert.match(seed, /Remed Assistance/);
  });

  it('kart başlığında seçilen kişi tipi durur', () => {
    assert.equal(userInviteCardTitle({ mode: 'add' }), 'Kullanıcı Ekle');
    assert.equal(
      userInviteCardTitle({ mode: 'add', taskLabel: 'Meridyen Dosya Sorumlusu' }),
      'Kullanıcı Ekle — Meridyen Dosya Sorumlusu',
    );
    assert.equal(
      userInviteCardTitle({ mode: 'edit', personName: 'Aslı Güngör', taskLabel: 'Finans' }),
      'Kullanıcıyı Düzenle — Aslı Güngör · Finans',
    );
    const page = readFileSync(join(here, '../page.tsx'), 'utf8');
    assert.match(page, /userInviteCardTitle/);
  });

  it('sigorta seçimi Ayarlar listesidir', () => {
    const config = readFileSync(join(here, 'user-invite-config.ts'), 'utf8');
    assert.doesNotMatch(config, /function portalInsuranceChoices/);
    const page = readFileSync(join(here, '../page.tsx'), 'utf8');
    assert.match(page, /\/panel\/ayarlar\/sigorta-sirketleri/);
    assert.doesNotMatch(page, /isLinkedInsurancePortalCustomer/);
    assert.doesNotMatch(page, /portalInsuranceChoices/);
  });
});
