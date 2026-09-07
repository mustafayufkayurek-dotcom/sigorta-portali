import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  NEW_PASSWORD_MIN_LENGTH,
  PASSWORD_BCRYPT_ROUNDS,
  PASSWORD_MAX_LENGTH,
  hashPassword,
  verifyPassword,
} from './password-hash.ts';

describe('şifre hash LOCK', () => {
  it('yeni hash 12 tur bcrypt kullanır', async () => {
    const hash = await hashPassword('GuvenliSifre1');
    assert.match(hash, new RegExp(`^\\$2[aby]\\$${String(PASSWORD_BCRYPT_ROUNDS).padStart(2, '0')}\\$`));
    assert.equal(await verifyPassword('GuvenliSifre1', hash), true);
    assert.equal(await verifyPassword('yanlis', hash), false);
  });

  it('çok uzun girdi karşılaştırılmaz', async () => {
    const hash = await hashPassword('GuvenliSifre1');
    assert.equal(await verifyPassword('x'.repeat(PASSWORD_MAX_LENGTH + 1), hash), false);
    assert.equal(NEW_PASSWORD_MIN_LENGTH, 8);
  });
});
