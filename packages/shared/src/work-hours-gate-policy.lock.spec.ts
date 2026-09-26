/**
 * Mesai kapısı kişi kaydında. İsim gömülmez.
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/work-hours-gate-policy.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isMeridyenStaffRole, workHoursGateApplies } from './work-hours-gate-policy.ts';

describe('mesai kapısı kişi kaydı LOCK', () => {
  it('yalnız Meridyen personeli kapıya girer', () => {
    assert.equal(isMeridyenStaffRole('finance'), true);
    assert.equal(isMeridyenStaffRole('office_staff'), true);
    assert.equal(isMeridyenStaffRole('field_staff'), true);
    assert.equal(isMeridyenStaffRole('admin'), true);
    assert.equal(isMeridyenStaffRole('expert'), false);
    assert.equal(isMeridyenStaffRole('insurance_company_user'), false);
    assert.equal(isMeridyenStaffRole('broker_user'), false);
    assert.equal(isMeridyenStaffRole('assistance_company_user'), false);
  });

  it('rol varsayılanı durur; kişi kaydı açar veya kapatır', () => {
    assert.equal(workHoursGateApplies({ roleCode: 'finance' }), true);
    assert.equal(workHoursGateApplies({ roleCode: 'office_staff' }), true);
    assert.equal(workHoursGateApplies({ roleCode: 'admin' }), false);
    assert.equal(workHoursGateApplies({ roleCode: 'manager' }), false);
    assert.equal(workHoursGateApplies({ roleCode: 'finance', restrictedOverride: false }), false);
    assert.equal(workHoursGateApplies({ roleCode: 'admin', restrictedOverride: true }), true);
    assert.equal(workHoursGateApplies({ roleCode: 'expert', restrictedOverride: true }), false);
    assert.equal(workHoursGateApplies({ roleCode: 'broker_user' }), true);
  });
});

