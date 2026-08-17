/**
 * Kaynak dosya kilidi — Yetkilendirme whitelist + Finans vendor.delete.
 * Çalıştır: npx tsx --test src/modules/rbac/role-capabilities.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  CAPABILITY_GROUPS,
  expandCapabilityIds,
  isManagedPermissionCode,
} from './role-capabilities';

const backendSrc = join(__dirname, '../..');

function readRel(rel: string): string {
  return readFileSync(join(backendSrc, rel), 'utf8');
}

describe('role-capabilities LOCK', () => {
  it('ilk sürüm yalnız Tedarikçiler grubu + üç işlem', () => {
    assert.equal(CAPABILITY_GROUPS.length, 1);
    assert.equal(CAPABILITY_GROUPS[0].id, 'vendors');
    const ids = CAPABILITY_GROUPS[0].capabilities.map((c) => c.id).sort();
    assert.deepEqual(ids, ['vendor_delete', 'vendor_edit', 'vendor_view'].sort());
  });

  it('whitelist dışı kod yönetilmez', () => {
    assert.equal(isManagedPermissionCode('vendor.delete'), true);
    assert.equal(isManagedPermissionCode('role.manage'), false);
    assert.equal(isManagedPermissionCode('invoice.delete'), false);
  });

  it('setCapabilities admin koruması ve whitelist doğrulaması kodda durur', () => {
    const svc = readRel('modules/rbac/roles.service.ts');
    assert.match(svc, /Yönetici rolünün yetkileri bu ekrandan değiştirilemez/);
    assert.match(svc, /isManagedPermissionCode/);
    assert.match(svc, /Geçersiz yetenek seçimi/);
    assert.match(svc, /yönetilmeyen|preservedOtherCount|unmanaged/i);
  });

  it('controller capability uçları role.view / role.manage ister', () => {
    const ctrl = readRel('modules/rbac/roles.controller.ts');
    assert.match(ctrl, /capability-catalog/);
    assert.match(ctrl, /@RequirePermissions\('role\.view'\)/);
    assert.match(ctrl, /@Put\(':id\/capabilities'\)[\s\S]*@RequirePermissions\('role\.manage'\)/);
  });

  it('FINANS guard + seed vendor.delete içerir', () => {
    const guard = readRel('common/guards/permissions.guard.ts');
    assert.match(guard, /FINANS:[\s\S]*vendor\.delete/);

    const seed = readFileSync(
      join(__dirname, '../../../prisma/seed.ts'),
      'utf8',
    );
    assert.match(seed, /financePermCodes[\s\S]*vendor\.delete/);
  });

  it('vendor_delete yalnız vendor.delete açar', () => {
    assert.deepEqual(expandCapabilityIds(['vendor_delete']), ['vendor.delete']);
  });
});
