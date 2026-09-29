/**
 * Rol hesabı ailesi — kod personelde durmaz; kilitli görev anahtarı değişmez.
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/role-account-family.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  isAssistanceCompanyRoleCode,
  isAssistanceCompanyRoleName,
  isLockedRoleAccountCode,
  isMeridyenInternalStaffRole,
  belongsOnPortalOfficePersonnelList,
  isValidNewRoleAccountCode,
  roleAccountFamilyFromCode,
  roleAccountFamilyLabel,
  roleAccountKindLabel,
  suggestRoleAccountCode,
} from './role-account-family.ts';

describe('rol hesap ailesi LOCK', () => {
  it('kilitli görevler aileye göre durur; yeni kod MER/DIS üretir', () => {
    assert.equal(roleAccountFamilyFromCode('office_staff'), 'meridyen');
    assert.equal(roleAccountFamilyFromCode('insurance_company_user'), 'dis');
    assert.equal(roleAccountFamilyFromCode('DIS_OZEL'), 'dis');
    assert.equal(isMeridyenInternalStaffRole('office_staff'), true);
    assert.equal(isMeridyenInternalStaffRole('insurance_company_user'), false);
    assert.equal(belongsOnPortalOfficePersonnelList({ id: 'u-1', roleCode: 'office_staff' }), false);
    assert.equal(belongsOnPortalOfficePersonnelList({ id: 'contact:1', roleCode: 'office_staff' }), true);
    assert.equal(isAssistanceCompanyRoleCode('assistance_company_user'), true);
    assert.equal(isAssistanceCompanyRoleCode('DIS_ASISTANS_FIRMA'), true);
    assert.equal(isAssistanceCompanyRoleName('Asistans Firma'), true);
    assert.equal(isAssistanceCompanyRoleCode('office_staff'), false);
    assert.equal(roleAccountKindLabel('office_staff'), 'Dosya Sorumlusu');
    assert.equal(roleAccountFamilyLabel('meridyen'), 'Meridyen Personeli');
    assert.equal(isLockedRoleAccountCode('office_staff'), true);
    assert.equal(isLockedRoleAccountCode('MER_OZEL'), false);
    const code = suggestRoleAccountCode('meridyen', 'Bölge Koordinatörü');
    assert.equal(code.startsWith('MER_'), true);
    assert.equal(isValidNewRoleAccountCode(code), true);
    assert.equal(isValidNewRoleAccountCode('office_staff'), false);
  });

  it('Rol Yönetimi kod göstermez; kayıtta anahtar üstüne yazılmaz', () => {
    const page = readFileSync(
      new URL('../../../apps/web/src/app/panel/ayarlar/roller/page.tsx', import.meta.url),
      'utf8',
    );
    const svc = readFileSync(
      new URL('../../../apps/backend/src/modules/rbac/roles.service.ts', import.meta.url),
      'utf8',
    );
    assert.match(page, /roleAccountFamilyFromCode/);
    assert.match(page, /Meridyen Personeli/);
    assert.match(page, /Dış Kullanıcı/);
    assert.doesNotMatch(page, />Kod</);
    assert.doesNotMatch(page, /form\.code/);
    assert.match(svc, /suggestRoleAccountCode/);
    assert.match(svc, /kod bu ekrandan değişmez/);
  });
});
