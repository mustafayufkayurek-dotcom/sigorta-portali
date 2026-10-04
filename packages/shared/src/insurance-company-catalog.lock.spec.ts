/**
 * Ayarlara eklenen sigorta şirketi Hasar Yeni Dosya listesinde durur.
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/insurance-company-catalog.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  HASAR_FILE_INSURANCE_CATALOG_QUERY,
  SETTINGS_INSURANCE_CATALOG_QUERY,
  filterInsuranceCatalogForHasarFileForm,
  insuranceCompanyListWhere,
} from './insurance-company-catalog.ts';

const catalog = [
  { id: 'allianz', name: 'Allianz' },
  { id: 'gig', name: 'GIG Sigorta' },
];

describe('hasar sigorta şirketi katalog LOCK', () => {
  it('status=all pasifi kesmez; boş istek yalnız aktifi alır', () => {
    assert.deepEqual(insuranceCompanyListWhere('all'), {});
    assert.deepEqual(insuranceCompanyListWhere(undefined), { status: 'active' });
    assert.deepEqual(insuranceCompanyListWhere('active'), { status: 'active' });
  });

  it('dosya sorumlusu Ayarlardaki GIG’i kişisel kapsamda olmasa da görür', () => {
    const officeList = filterInsuranceCatalogForHasarFileForm(
      catalog,
      'office_staff',
      [{ id: 'allianz', name: 'Allianz' }],
    );
    assert.equal(officeList.some((c) => c.id === 'gig'), true);
    assert.equal(officeList.length, 2);

    const adminList = filterInsuranceCatalogForHasarFileForm(catalog, 'admin', ['allianz']);
    assert.equal(adminList.some((c) => c.id === 'gig'), true);
  });

  it('sigorta portal kullanıcısı yalnız kendi şirketini görür', () => {
    const portal = filterInsuranceCatalogForHasarFileForm(
      catalog,
      'insurance_company_user',
      [{ id: 'allianz' }],
    );
    assert.deepEqual(
      portal.map((c) => c.id),
      ['allianz'],
    );
  });

  it('Yeni Dosya ofis kapsamı ile GIG’i kesmez; Ayarlar ile aynı limit durur', () => {
    const form = readFileSync(
      new URL('../../../apps/web/src/components/claim-files/ClaimNewForm.tsx', import.meta.url),
      'utf8',
    );
    const settings = readFileSync(
      new URL('../../../apps/web/src/app/panel/ayarlar/sigorta-sirketleri/page.tsx', import.meta.url),
      'utf8',
    );
    const service = readFileSync(
      new URL(
        '../../../apps/backend/src/modules/insurance-companies/insurance-companies.service.ts',
        import.meta.url,
      ),
      'utf8',
    );
    const edit = readFileSync(
      new URL(
        '../../../apps/web/src/app/panel/hasar-dosyalari/[id]/_components/DosyaBilgileriEditModal.tsx',
        import.meta.url,
      ),
      'utf8',
    );
    const eksper = readFileSync(
      new URL('../../../apps/web/src/app/panel/eksper-portal/page.tsx', import.meta.url),
      'utf8',
    );
    const picker = readFileSync(
      new URL('../../../apps/web/src/components/CustomerSelectModal.tsx', import.meta.url),
      'utf8',
    );
    assert.match(form, /filterInsuranceCatalogForHasarFileForm/);
    assert.match(form, /HASAR_FILE_INSURANCE_CATALOG_QUERY/);
    assert.doesNotMatch(form, /isOfficeStaffRole\(roleCode\) && scopedIds/);
    assert.match(settings, /SETTINGS_INSURANCE_CATALOG_QUERY/);
    assert.match(service, /insuranceCompanyListWhere/);
    assert.match(edit, /claim-files\/assignable-staff/);
    assert.match(edit, /includeDelegates:\s*'hasar'/);
    assert.doesNotMatch(edit, /\/users\?limit=/);
    assert.match(eksper, /HASAR_FILE_INSURANCE_CATALOG_QUERY/);
    const acil = readFileSync(
      new URL('../../../apps/web/src/components/emergency/EmergencyCaseNewForm.tsx', import.meta.url),
      'utf8',
    );
    assert.match(picker, /OFFICE_SETTINGS_CATALOG_LIMIT/);
    assert.match(acil, /OFFICE_SETTINGS_CATALOG_LIMIT/);
    assert.equal(HASAR_FILE_INSURANCE_CATALOG_QUERY.limit, 1000);
    assert.equal(SETTINGS_INSURANCE_CATALOG_QUERY.status, 'all');
  });
});
