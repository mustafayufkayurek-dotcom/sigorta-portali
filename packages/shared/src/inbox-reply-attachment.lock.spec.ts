/**
 * Gelen kutu yanıtında fotoğraf/belge asıl yazıyla birlikte gider.
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/inbox-reply-attachment.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  INBOX_REPLY_ATTACH_MAX_BYTES,
  INBOX_REPLY_ATTACH_MAX_FILES,
  isInboxReplyAttachmentAllowed,
  sanitizeInboxReplyAttachmentName,
} from './inbox-reply-attachment.ts';

describe('gelen kutu yanıt eki LOCK', () => {
  it('fotoğraf ve belgeye izin verir; exe yok', () => {
    assert.equal(isInboxReplyAttachmentAllowed('cam.jpg', 'image/jpeg'), true);
    assert.equal(isInboxReplyAttachmentAllowed('teklif.pdf', 'application/pdf'), true);
    assert.equal(isInboxReplyAttachmentAllowed('virus.exe', 'application/octet-stream'), false);
    assert.equal(INBOX_REPLY_ATTACH_MAX_FILES, 5);
    assert.equal(INBOX_REPLY_ATTACH_MAX_BYTES, 3_000_000);
  });

  it('dosya adından yol ve yasak karakter düşer', () => {
    assert.equal(sanitizeInboxReplyAttachmentName('C:\\\\tmp\\\\a<b>.jpg'), 'a_b_.jpg');
  });

  it('yanıt Graph comment kullanmaz; ek aynı reply gövdesindedir', () => {
    const send = readFileSync(
      new URL('../../../apps/backend/src/modules/operation-inbox/graph/graph-mail-send.service.ts', import.meta.url),
      'utf8',
    );
    const replyFn = send.slice(send.indexOf('async sendReply'), send.indexOf('async sendMail'));
    assert.match(replyFn, /toGraphFileAttachments/);
    assert.match(replyFn, /attachments: graphAttachments/);
    assert.match(replyFn, /ccRecipients/);
    assert.doesNotMatch(replyFn, /comment:/);
    assert.match(send, /fileAttachment/);
    assert.match(send, /contentBytes/);
    assert.doesNotMatch(replyFn, /createUploadSession/);
    assert.doesNotMatch(send, /Mail\.ReadWrite/);
  });

  it('yanıt kutusu Fotoğraf Veya Belge ekler; ayrı mail ekranı yok', () => {
    const modal = readFileSync(
      new URL('../../../apps/web/src/components/operation-inbox/InboxReplyModal.tsx', import.meta.url),
      'utf8',
    );
    assert.match(modal, /Fotoğraf Veya Belge/);
    assert.match(modal, /contentBase64/);
    assert.match(modal, /attachments/);
    assert.match(modal, /Alıcıda yazışma geçmişi/);
    assert.match(modal, /\/operation-inbox\/messages\/\$\{messageId\}\/reply/);
    const dto = readFileSync(
      new URL('../../../apps/backend/src/modules/operation-inbox/dto/reply-message.dto.ts', import.meta.url),
      'utf8',
    );
    assert.match(dto, /contentBase64/);
    assert.match(dto, /attachments/);
  });
});
