/**
 * Dashboard rol kapsamı ve zarf kilitleri.
 * Backend: node --experimental-strip-types --test src/modules/dashboard/dashboard-role.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  hasDashboardFinanceAccessRole,
  isOfficeStaffDashboardRole,
  normalizeDashboardRoleCode,
  pendingActionOwnerAliases,
} from './dashboard-role.ts';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(join(here, rel), 'utf8');

describe('dashboard-role lock', () => {
  it('office_staff alias ve JWT roleCode aynı kapsama düşer', () => {
    assert.equal(normalizeDashboardRoleCode('OFFICE_STAFF'), 'office_staff');
    assert.equal(normalizeDashboardRoleCode({ roleCode: 'office-staff' }), 'office_staff');
    assert.equal(isOfficeStaffDashboardRole('OFFICE_STAFF'), true);
    assert.equal(isOfficeStaffDashboardRole('admin'), false);
    assert.equal(hasDashboardFinanceAccessRole('FINANCE'), true);
    assert.equal(hasDashboardFinanceAccessRole('accountant'), true);
    assert.equal(hasDashboardFinanceAccessRole('office_staff'), false);
    const aliases = pendingActionOwnerAliases('OFFICE_STAFF');
    assert.ok(aliases.includes('office_staff'));
    assert.ok(aliases.includes('OFFICE_STAFF'));
  });

  it('controller ofis kapsamını normalize edilmiş rolle açar', () => {
    const ctrl = read('./dashboard.controller.ts');
    assert.match(ctrl, /isOfficeStaffDashboardRole/);
    assert.match(ctrl, /hasDashboardFinanceAccessRole/);
    assert.doesNotMatch(ctrl, /roleCode === 'office_staff'/);
  });

  it('bekleyen aksiyon pendingActionOwner alias ile sorgulanır', () => {
    const svc = read('./dashboard.service.ts');
    assert.match(svc, /pendingActionOwnerAliases/);
    assert.match(svc, /pendingActionOwner: \{ in: ownerAliases \}/);
    assert.match(svc, /claimFileId: h\.claimFileId/);
  });
});
