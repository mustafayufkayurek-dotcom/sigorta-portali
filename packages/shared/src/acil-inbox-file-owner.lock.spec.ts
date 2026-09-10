/**
 * Acil gelen kutu: dosya sorumlusu sigortalı veya Test Kullanıcı olmaz.
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/acil-inbox-file-owner.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isPlaceholderOfficeUser,
  isPlaceholderOfficeUserName,
  resolveAcilInboxFileOwnerId,
} from './acil-inbox-file-owner.ts';

describe('acil gelen kutu dosya sorumlusu LOCK', () => {
  it('açık seçim yoksa işlemi yapanı yazar', () => {
    assert.equal(
      resolveAcilInboxFileOwnerId({
        actorUserId: 'mustafa',
        insuredName: 'Cennet Durur',
      }),
      'mustafa',
    );
  });

  it('sigortalı adını dosya sorumlusu olarak kabul etmez', () => {
    assert.equal(
      resolveAcilInboxFileOwnerId({
        actorUserId: 'mustafa',
        explicitUserId: 'insured-user',
        explicitUserName: 'Cennet Durur',
        insuredName: 'Cennet Durur',
      }),
      'mustafa',
    );
  });

  it('Test Kullanıcı otomatik / yanlış seçimini işlemi yapana çevirir', () => {
    assert.equal(isPlaceholderOfficeUserName('Test Kullanıcı'), true);
    assert.equal(
      isPlaceholderOfficeUser({ firstName: 'Test', lastName: 'Kullanıcı', email: 'admin@example.com' }),
      true,
    );
    assert.equal(
      resolveAcilInboxFileOwnerId({
        actorUserId: 'mustafa',
        explicitUserId: 'test-user',
        explicitUserName: 'Test Kullanıcı',
        insuredName: 'Cennet Durur',
      }),
      'mustafa',
    );
  });

  it('işlemi yapan Test Kullanıcı ise kendi kaydı durur', () => {
    assert.equal(
      resolveAcilInboxFileOwnerId({
        actorUserId: 'test-user',
        explicitUserId: 'test-user',
        explicitUserName: 'Test Kullanıcı',
        insuredName: 'Cennet Durur',
      }),
      'test-user',
    );
  });

  it('başka gerçek personel açık seçildiyse o kalır', () => {
    assert.equal(
      resolveAcilInboxFileOwnerId({
        actorUserId: 'mustafa',
        explicitUserId: 'ayse',
        explicitUserName: 'Ayşe Ofis',
        insuredName: 'Cennet Durur',
      }),
      'ayse',
    );
  });
});
