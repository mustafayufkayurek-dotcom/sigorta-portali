/**
 * Onaya Gönder: alıcı seçimi + sabit Meridyen bilgilendirme CC.
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/claim-approval-mail-selection.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  filterSelectedApprovalEmails,
  mergeApprovalMailCc,
  resolveApprovalFileOwnerCc,
  resolveApprovalInformCc,
} from './claim-approval-mail-selection.ts';

describe('onaya gönder alıcı seçimi LOCK', () => {
  it('yalnız işaretlenen izinli adresleri alır; yabancı adresi keser', () => {
    const allowed = ['broker@ornek.com', 'eksper@ornek.com', 'sigorta@ornek.com'];
    assert.deepEqual(
      filterSelectedApprovalEmails(allowed, ['eksper@ornek.com', 'yabanci@x.com']),
      ['eksper@ornek.com'],
    );
  });

  it('seçim yoksa tüm izinli adresler kalır', () => {
    assert.deepEqual(
      filterSelectedApprovalEmails(['a@ornek.com', 'b@ornek.com'], null),
      ['a@ornek.com', 'b@ornek.com'],
    );
  });

  it('bilgilendirme CC oturumdaki personelden gelir; ortak kutu ve gömülü adres yok', () => {
    assert.deepEqual(
      resolveApprovalInformCc({ email: 'mustafa@meridyen-tr.com', firstName: 'Mustafa', lastName: 'Yufkayürek' }),
      { email: 'mustafa@meridyen-tr.com', name: 'Mustafa Yufkayürek' },
    );
    assert.equal(resolveApprovalInformCc({ email: 'hasar@meridyen-tr.com' }), null);
    assert.equal(resolveApprovalInformCc({ email: 'hasar@safranbh.com' }), null);
  });

  it('dosya sorumlusu otomatik Bilgi adresidir; ortak kutu yok', () => {
    assert.deepEqual(
      resolveApprovalFileOwnerCc({
        email: 'sorumlu@meridyen-tr.com',
        firstName: 'Ayşe',
        lastName: 'Yılmaz',
      }),
      { email: 'sorumlu@meridyen-tr.com', name: 'Ayşe Yılmaz' },
    );
    assert.equal(resolveApprovalFileOwnerCc({ email: 'hasar@meridyen-tr.com' }), null);
  });

  it('CC Kime ile çakışmaz; bilgilendirme silinemez sırada ilk durur', () => {
    const cc = mergeApprovalMailCc({
      informCc: { email: 'ofis@meridyen-tr.com', name: 'Dosya Sorumlusu' },
      extraCc: [{ email: 'yetkili@musteri.com', name: 'Yetkili' }],
      toEmails: ['broker@ornek.com', 'ofis@meridyen-tr.com'],
    });
    assert.deepEqual(cc, [{ email: 'yetkili@musteri.com', name: 'Yetkili' }]);
    const withInform = mergeApprovalMailCc({
      informCc: { email: 'gonderen@meridyen-tr.com', name: 'Gönderen' },
      extraCc: [
        { email: 'sorumlu@meridyen-tr.com', name: 'Dosya Sorumlusu' },
        { email: 'yetkili@musteri.com' },
      ],
      toEmails: ['broker@ornek.com'],
    });
    assert.equal(withInform[0]?.email, 'gonderen@meridyen-tr.com');
    assert.equal(withInform[1]?.email, 'sorumlu@meridyen-tr.com');
    assert.equal(withInform[2]?.email, 'yetkili@musteri.com');
  });
});
