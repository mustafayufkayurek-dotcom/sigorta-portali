import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  capabilityIdsFromPermissionCodes,
  expandCapabilityIds,
  isManagedPermissionCode,
} from './role-capabilities';

describe('role-capabilities', () => {
  it('vendor_delete → vendor.delete genişler', () => {
    assert.deepEqual(expandCapabilityIds(['vendor_delete']), ['vendor.delete']);
  });

  it('vendor_edit create+update ister', () => {
    assert.deepEqual(
      expandCapabilityIds(['vendor_edit']).sort(),
      ['vendor.create', 'vendor.update'].sort(),
    );
  });

  it('permission kodlarından capability id üretir', () => {
    assert.deepEqual(
      capabilityIdsFromPermissionCodes([
        'vendor.view',
        'vendor.create',
        'vendor.update',
        'vendor.delete',
        'invoice.view',
      ]).sort(),
      ['vendor_delete', 'vendor_edit', 'vendor_view'].sort(),
    );
  });

  it('yönetilen kod tanıma', () => {
    assert.equal(isManagedPermissionCode('vendor.delete'), true);
    assert.equal(isManagedPermissionCode('invoice.view'), false);
  });
});
