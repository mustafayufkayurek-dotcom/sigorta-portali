/**
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/acil-locksmith-issue.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isAcilLocksmithIssue } from './acil-locksmith-issue.ts';

describe('acil çilingir konu LOCK', () => {
  it('çilingir ve kapı/kilit konuyu ayırır', () => {
    assert.equal(isAcilLocksmithIssue('Çilingir'), true);
    assert.equal(isAcilLocksmithIssue('Kapı/Kilit Arızası'), true);
    assert.equal(isAcilLocksmithIssue('Çingir Acil'), true);
  });

  it('çekici lastik cam gibi konuları çilingir saymaz', () => {
    assert.equal(isAcilLocksmithIssue('Çekici'), false);
    assert.equal(isAcilLocksmithIssue('Lastik Değişimi'), false);
    assert.equal(isAcilLocksmithIssue('Cam Kırılması'), false);
    assert.equal(isAcilLocksmithIssue(''), false);
  });
});
