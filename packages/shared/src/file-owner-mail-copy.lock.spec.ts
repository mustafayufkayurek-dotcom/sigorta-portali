/**
 * Platform Mail Kopyası: gönderene görünür CC, asıl yazı ile aynı gönderim.
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/file-owner-mail-copy.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  PLATFORM_MAIL_COPY_TITLE,
  buildCrmSenderCopyNotice,
  buildPlatformMailCopyNotice,
  platformMailCopyLineLabel,
  prependFileOwnerCopyNotice,
  welcomeInviteAdminCopies,
} from './file-owner-mail-copy.ts';

describe('platform mail kopyası LOCK', () => {
  it('başlık sabit; satır maili atana göre değişir', () => {
    assert.equal(PLATFORM_MAIL_COPY_TITLE, 'Platform Mail Kopyası');
    assert.equal(platformMailCopyLineLabel('finance'), 'Finans Kopyası');
    assert.equal(platformMailCopyLineLabel('admin'), 'Yönetici Kopyası');
    assert.equal(platformMailCopyLineLabel('manager'), 'Müdür Kopyası');
    assert.equal(platformMailCopyLineLabel('office_staff'), 'Dosya Sorumlusu Kopyası');
    const finance = buildPlatformMailCopyNotice({
      counterpartName: 'Safran BH',
      counterpartAddress: 'acil@safran.example',
      sender: { name: 'Ayşe Finans', email: 'ayse@meridyen-tr.com' },
      roleCode: 'finance',
      sentAt: '2026-09-13T12:48:00.000Z',
    });
    assert.match(finance.html, />Platform Mail Kopyası</);
    assert.match(finance.plain, /Finans Kopyası: Ayşe Finans \(ayse@meridyen-tr.com\)/);
    assert.match(finance.html, /<strong>Karşı Taraf:<\/strong>/);
    assert.match(finance.html, /<strong>Finans Kopyası:<\/strong>/);
    assert.match(finance.html, /<strong>Gönderim Tarihi:<\/strong>/);
    assert.match(finance.html, /Bu İleti Platform Üzerinden Yapılan Yazışmanın Teyidi Amacı İle Gönderilmiştir/);
    assert.doesNotMatch(finance.html, /Taşımaktadır/);
    assert.doesNotMatch(finance.html, /Bu kopya/);
    assert.doesNotMatch(finance.html, /Karşı taraf:/);
    assert.doesNotMatch(finance.html, /bcc/i);
    const owner = buildPlatformMailCopyNotice({
      counterpartName: 'Safran BH',
      counterpartAddress: 'acil@safran.example',
      sender: { name: 'Ayşe Ofis', email: 'ayse@meridyen-tr.com' },
      roleCode: 'office_staff',
      sentAt: '2026-09-13T12:48:00.000Z',
    });
    assert.match(owner.plain, /Dosya Sorumlusu Kopyası: Ayşe Ofis \(ayse@meridyen-tr.com\)/);
    assert.match(owner.html, /<strong>Dosya Sorumlusu Kopyası:<\/strong>/);
  });

  it('not gövdenin başına eklenir', () => {
    const wrapped = prependFileOwnerCopyNotice('<div>Onaylandı</div>', '<div>NOT</div>');
    assert.ok(wrapped.indexOf('NOT') < wrapped.indexOf('Onaylandı'));
  });

  it('CRM kopyası gönderen diye yazar; dosya sorumlusu diye yazmaz', () => {
    const notice = buildCrmSenderCopyNotice({
      counterpartAddress: 'aday@ornek.com',
      sender: { name: 'Ayşe', email: 'ayse@meridyen-tr.com' },
    });
    assert.match(notice.plain, /Platform Mail Kopyası/);
    assert.match(notice.plain, /Gönderen Kopyası/);
    assert.doesNotMatch(notice.plain, /Dosya sorumlusu kopyası/);
  });

  it('hoş geldin kopyası yöneticiye gider; yeni kullanıcıya kopya düşmez', () => {
    const copies = welcomeInviteAdminCopies(
      [
        { name: 'Sistem Yöneticisi', email: 'admin@meridyenassistance.com' },
        { name: 'Yeni Kişi', email: 'yeni@firma.com' },
        { name: 'Hasar Kutu', email: 'hasar@meridyen-tr.com' },
      ],
      'yeni@firma.com',
    );
    assert.equal(copies.length, 1);
    assert.equal(copies[0]?.email, 'admin@meridyenassistance.com');
    const users = readFileSync(
      new URL('../../../apps/backend/src/modules/users/users.service.ts', import.meta.url),
      'utf8',
    );
    const welcome = users.slice(users.indexOf('private async sendWelcomeInviteEmail'));
    assert.match(welcome, /welcomeInviteAdminCopies/);
    assert.match(welcome, /readReceiptTo/);
    assert.match(welcome, /copyNoticeHtml/);
    assert.doesNotMatch(welcome, /bccRecipients/);
  });

  it('kopya ayrı mail değil; aynı gönderimin görünür kopyasıdır', () => {
    const send = readFileSync(
      new URL('../../../apps/backend/src/modules/operation-inbox/graph/graph-mail-send.service.ts', import.meta.url),
      'utf8',
    );
    assert.match(send, /ccRecipients/);
    assert.doesNotMatch(send, /bccRecipients/);
    assert.match(send, /Asıl yazı gitmezse kopya da gitmez/);
    const inbox = readFileSync(
      new URL('../../../apps/backend/src/modules/operation-inbox/operation-inbox.service.ts', import.meta.url),
      'utf8',
    );
    const replyFn = inbox.slice(inbox.indexOf('async replyMessage'), inbox.indexOf('async composeMessage'));
    assert.match(replyFn, /sendReply\(/);
    assert.doesNotMatch(replyFn, /sendMail\(/);
    assert.match(replyFn, /resolveSenderMailCopy/);
    assert.match(inbox, /async composeMessage/);
    assert.match(inbox, /resolveSenderMailCopy/);
    assert.doesNotMatch(inbox, /resolveFileOwnerCopy/);
    const email = readFileSync(
      new URL('../../../apps/backend/src/modules/notifications/email/email.service.ts', import.meta.url),
      'utf8',
    );
    const graphBlock = email.slice(email.indexOf('if (graphReady)'), email.indexOf('const transport = await this.resolveMailTransport()'));
    assert.match(graphBlock, /return \{ sent: false/);
    assert.doesNotMatch(graphBlock, /transporter\.sendMail/);
    const modal = readFileSync(
      new URL('../../../apps/web/src/components/operation-inbox/InboxReplyModal.tsx', import.meta.url),
      'utf8',
    );
    assert.match(modal, /Platform Mail Kopyası/);
    assert.match(modal, /Asıl yazı gitmezse kopya da gitmez/);
    assert.match(modal, /platformMailCopyLineLabel/);
  });

  it('Hasar ve Acil aynı yazışma panelini kullanır', () => {
    const hasar = readFileSync(
      new URL('../../../apps/web/src/app/panel/hasar-dosyalari/[id]/_components/tabs/IletisimTab.tsx', import.meta.url),
      'utf8',
    );
    const acil = readFileSync(
      new URL('../../../apps/web/src/app/panel/acil-yardim/[id]/page.tsx', import.meta.url),
      'utf8',
    );
    assert.match(hasar, /InboundEmailCorrespondencePanel/);
    assert.match(hasar, /claimFileId/);
    assert.match(acil, /InboundEmailCorrespondencePanel/);
    assert.match(acil, /emergencyCaseId/);
  });
});
