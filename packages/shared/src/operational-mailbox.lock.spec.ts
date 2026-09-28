/**
 * Ortak kutu kendi yazılım yazısını kuyruğa düşürmez; dış yazı durur.
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/operational-mailbox.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  filterSoftwareMailboxRecipients,
  isMeridyenInternalMailbox,
  isOperationalSharedMailbox,
  isSoftwareOutboundInboxEcho,
} from './operational-mailbox.ts';

describe('gelen kutu yazılım yankısı LOCK', () => {
  it('ortak kutu dosya mailinde alıcı olmaz; yardım firması durur', () => {
    assert.equal(isOperationalSharedMailbox('ihbar@safranbh.com'), true);
    assert.equal(isOperationalSharedMailbox('hasar@safranbh.com'), true);
    assert.equal(isOperationalSharedMailbox('ihbar@meridyen-tr.com'), true);
    assert.equal(isMeridyenInternalMailbox('ihbar@safranbh.com'), true);
    assert.equal(isMeridyenInternalMailbox('operasyon@remed.com'), false);
    assert.equal(isOperationalSharedMailbox('operasyon@safranbh.com'), false);
  });

  it('kendi kapanış yankısı kuyruk değildir; yanıt ve dış yazı kuyruktadır', () => {
    assert.equal(
      isSoftwareOutboundInboxEcho({
        fromAddress: 'ihbar@safranbh.com',
        subject: 'Dosya Kapanışı – RCS-20261891200',
        mailboxAddress: 'ihbar@safranbh.com',
      }),
      true,
    );
    assert.equal(
      isSoftwareOutboundInboxEcho({
        fromAddress: 'ihbar@safranbh.com',
        subject: 'Ynt: Dosya Kapanışı – RCS-20261891200',
        mailboxAddress: 'ihbar@safranbh.com',
      }),
      false,
    );
    assert.equal(
      isSoftwareOutboundInboxEcho({
        fromAddress: 'no-reply@remed.com.tr',
        subject: 'Dosya Kapanışı – RCS-20261891200',
        mailboxAddress: 'ihbar@safranbh.com',
      }),
      false,
    );
    assert.equal(
      isSoftwareOutboundInboxEcho({
        fromAddress: 'ihbar@safranbh.com',
        subject: '[Remed Assistance] Mutabakat Sağlandı',
        mailboxAddress: 'ihbar@safranbh.com',
      }),
      false,
    );
    assert.equal(
      isSoftwareOutboundInboxEcho({
        fromAddress: 'hasar@safranbh.com',
        subject: 'Ray-RCS-1-Onay Talep',
        mailboxAddress: 'hasar@safranbh.com',
      }),
      true,
    );
  });

  it('ortak kutuya giden alıcı düşer; personel ve dış taraf durur', () => {
    assert.deepEqual(
      filterSoftwareMailboxRecipients(
        ['ihbar@safranbh.com', 'operasyon@remed.com', 'ayse@meridyen-tr.com'],
        'ihbar@safranbh.com',
      ),
      ['operasyon@remed.com', 'ayse@meridyen-tr.com'],
    );
  });
});