import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ACIL_FILE_OWNER_PERMISSIONS,
  mergeAcilFileOwnerPermissions,
} from './acil-file-owner-delegation.ts';

describe('acil dosya sorumlusu vekalet yetkileri', () => {
  it('vekalet yoksa finans yetkisini genişletmez', () => {
    assert.deepEqual(
      mergeAcilFileOwnerPermissions(['claim_file.view', 'invoice.view'], false),
      ['claim_file.view', 'invoice.view'],
    );
  });

  it('vekalette oluşturma, atama ve durum değişimi eklenir', () => {
    const merged = mergeAcilFileOwnerPermissions(['claim_file.view'], true);
    assert.ok(merged.includes('claim_file.create'));
    assert.ok(merged.includes('claim_file.assign'));
    assert.ok(merged.includes('claim_file.status_change'));
    assert.ok(ACIL_FILE_OWNER_PERMISSIONS.includes('operation_inbox.manage'));
  });
});
