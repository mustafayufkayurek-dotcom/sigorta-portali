/**
 * Arşivdeki personel kalıcı silinirken müşteri erişim izi kaydı silmeyi kesmez.
 * Çalıştır: node --experimental-strip-types --test \
 *   apps/backend/src/modules/users/user-permanent-delete.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

describe('personel kalıcı silme LOCK', () => {
  it('müşteri erişim izini silmeden kullanıcıyı silmez', () => {
    const service = readFileSync(new URL('./users.service.ts', import.meta.url), 'utf8');
    const deleteBlock = service.slice(
      service.indexOf('async permanentDelete'),
      service.indexOf('async bulkDelete'),
    );
    assert.match(deleteBlock, /customerAccessLog\.deleteMany/);
    assert.match(deleteBlock, /user\.delete/);
    assert.ok(
      deleteBlock.indexOf('customerAccessLog.deleteMany') < deleteBlock.indexOf('user.delete'),
      'erişim izi kullanıcıdan önce düşer',
    );
    assert.match(deleteBlock, /Bu personelin iş kaydı duruyor/);
  });
});
