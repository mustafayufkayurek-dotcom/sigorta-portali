/**
 * Sistem yöneticisi: mail/ad değişir; arşiv/silme durur.
 * Çalıştır: node --experimental-strip-types --test \
 *   apps/backend/src/modules/users/system-admin-identity.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

describe('sistem yöneticisi kimlik LOCK', () => {
  it('mail değişebilir; arşiv ve silme kapalı kalır', () => {
    const service = readFileSync(new URL('./users.service.ts', import.meta.url), 'utf8');
    assert.match(service, /isProtectedSystemAccount/);
    assert.doesNotMatch(service, /Sistem yöneticisi düzenlenemez/);
    assert.doesNotMatch(service, /rest\.archivedEmail/);
    assert.match(service, /Sistem yöneticisi arşivlenemez/);
    assert.match(service, /Sistem yöneticisi kalıcı olarak silinemez/);
    const actions = readFileSync(
      new URL('../../../../web/src/components/users/AdminUserRowActions.tsx', import.meta.url),
      'utf8',
    );
    assert.match(actions, /id: 'edit'/);
    assert.doesNotMatch(actions, /Sistem yöneticisi düzenlenemez/);
    assert.match(actions, /hidden: protectedAdmin/);
    const usersPage = readFileSync(
      new URL('../../../../web/src/app/panel/kullanicilar/page.tsx', import.meta.url),
      'utf8',
    );
    assert.match(usersPage, /email: normalizeEmailAddress\(form\.email\)/);
  });
});
