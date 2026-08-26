/**
 * Acil fonksiyon vekaleti tüm kuyruğu ve dosya sorumlusu işini açar; işlem kaydında vekil durur.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/modules/operational-access-grants/acil-function-delegation-owner.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

describe('acil fonksiyon vekaleti LOCK', () => {
  it('liste kapsamı vekalette tüm kuyruğu açar', () => {
    const grants = readFileSync(join(here, 'operational-access-grants.service.ts'), 'utf8');
    assert.match(grants, /hasFunctionDelegation\(userId, 'acil_yardim'\)\) return \{\}/);
    assert.match(grants, /getFunctionDelegationStamp/);
    assert.match(grants, /grantType: 'function_delegation'/);
  });

  it('acil dosya erişimi vekalette kesilmez', () => {
    const emergency = readFileSync(
      join(here, '../emergency/emergency-cases.service.ts'),
      'utf8',
    );
    assert.match(emergency, /hasFunctionDelegation\(requestingUser\.id, 'acil_yardim'\)/);
    assert.match(emergency, /getFunctionDelegationStamp/);
  });

  it('oturum yetkisine dosya sorumlusu işleri eklenir; Hasar finansa sızmaz', () => {
    const jwtGuard = readFileSync(
      join(here, '../../common/guards/jwt-auth.guard.ts'),
      'utf8',
    );
    const auth = readFileSync(join(here, '../auth/auth.service.ts'), 'utf8');
    const claims = readFileSync(join(here, '../claim-files/claim-files.service.ts'), 'utf8');
    assert.match(jwtGuard, /mergeAcilFileOwnerPermissions/);
    assert.match(auth, /mergeAcilFileOwnerPermissions/);
    assert.match(claims, /assertHasarFileMutationAllowed/);
    assert.match(claims, /hasFunctionDelegation\(userId, 'hasar'\)/);
  });
});
