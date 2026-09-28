/**
 * Yazılım yankısı kuyruğa düşmez; sınıflandırma mail atmaz.
 * Çalıştır: node --experimental-strip-types --test \
 *   apps/backend/src/modules/operation-inbox/software-outbound-echo.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

describe('gelen kutu yazılım yankısı ingest LOCK', () => {
  it('yankıyı kuyruk dışına alır; sınıflandırma ve yanıt izi çalışmaz', () => {
    const ingest = readFileSync(join(here, 'processors/inbound-ingest.processor.ts'), 'utf8');
    assert.match(ingest, /isSoftwareOutboundInboxEcho/);
    assert.match(ingest, /quietSoftwareOutboundEcho\(created\.id\)/);
    assert.match(ingest, /attemptRuleBasedLink/);
    const createdEcho = ingest.indexOf('quietSoftwareOutboundEcho(created.id)');
    const classify = ingest.indexOf('classifyQueue.add');
    const counterpart = ingest.indexOf('applyOutboundCounterpartReply');
    assert.ok(createdEcho >= 0 && classify > createdEcho);
    assert.ok(counterpart > createdEcho);
  });

  it('gönderimde ortak kutu alıcı olmaz', () => {
    const send = readFileSync(join(here, 'graph/graph-mail-send.service.ts'), 'utf8');
    assert.match(send, /filterSoftwareMailboxRecipients/);
    assert.match(send, /Ortak kutu alıcı olmaz/);
    const email = readFileSync(
      join(here, '../notifications/email/email.service.ts'),
      'utf8',
    );
    assert.match(email, /filterSoftwareMailboxRecipients/);
  });
});
