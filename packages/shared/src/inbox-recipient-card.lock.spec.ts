/**
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/inbox-recipient-card.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  customerCardUserReminder,
  missingCustomerCardUserEmails,
  parseMailAddressList,
} from './inbox-recipient-card.ts';

describe('yanıt Kime ve müşteri kartı hatırlatma LOCK', () => {
  it('çoklu adresi ayırır; aynı alan adında kartta olmayanı hatırlatır', () => {
    assert.deepEqual(parseMailAddressList('a@remed.com.tr; konut@remed.com.tr, a@remed.com.tr'), [
      'a@remed.com.tr',
      'konut@remed.com.tr',
    ]);
    const missing = missingCustomerCardUserEmails({
      recipients: ['gamze.celik@eurekosigorta.com.tr', 'konut@remed.com.tr', 'kisi@gmail.com'],
      registeredEmails: ['info@remed.com.tr', 'hasar@remed.com.tr'],
    });
    assert.deepEqual(missing, ['konut@remed.com.tr']);
    const text = customerCardUserReminder(missing);
    assert.match(String(text), /konut@remed.com.tr/);
    assert.match(String(text), /müşteri kartında kullanıcı olarak yok/);
    assert.match(String(text), /Kullanıcı ekleyin/);
  });

  it('yanıt kutusu Kime ekler; Graph taslak açmaz', () => {
    const modal = readFileSync(
      new URL('../../../apps/web/src/components/operation-inbox/InboxReplyModal.tsx', import.meta.url),
      'utf8',
    );
    assert.match(modal, />Kime</);
    assert.match(modal, /extraTo/);
    assert.match(modal, /recipient-card-hints/);
    const dto = readFileSync(
      new URL('../../../apps/backend/src/modules/operation-inbox/dto/reply-message.dto.ts', import.meta.url),
      'utf8',
    );
    assert.match(dto, /extraTo/);
    const graph = readFileSync(
      new URL('../../../apps/backend/src/modules/operation-inbox/graph/graph-mail-send.service.ts', import.meta.url),
      'utf8',
    );
    const replyFn = graph.slice(graph.indexOf('async sendReply'), graph.indexOf('async sendMail'));
    assert.match(replyFn, /toRecipients/);
    assert.doesNotMatch(replyFn, /createUploadSession/);
    assert.doesNotMatch(replyFn, /comment:/);
  });
});
