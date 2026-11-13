/**
 * Microsoft geçici hata (429/5xx) verince mail kendiliğinden yeniden denenir.
 * Gönderim hatası «Kutu maili geri çevirdi» yazmaz; yanıt kutusu kilitlenmez, yeniden gönderilir.
 * Kaynak: 13.11.2026 Remed yazışması — replyAll HTTP 503/502, adres doğruydu.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/modules/operation-inbox/graph/graph-send-transient-retry.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const send = readFileSync(join(here, 'graph-mail-send.service.ts'), 'utf8');
const web = (p: string) => readFileSync(join(here, '../../../../../web/src/components/operation-inbox', p), 'utf8');

describe('Graph gönderim geçici hata LOCK', () => {
  it('sendMail ve yanıt aynı yeniden deneme kapısından geçer', () => {
    assert.match(send, /private async postWithTransientRetry\(/);
    assert.equal((send.match(/await this\.postWithTransientRetry\(/g) ?? []).length, 2);
    assert.match(send, /export const GRAPH_SEND_MAX_ATTEMPTS = 3;/);
    assert.match(send, /status === 429 \|\| status === 500 \|\| status === 502 \|\| status === 503 \|\| status === 504/);
    assert.match(send, /Math\.min\(seconds, 10\) \* 1000/);
    assert.match(send, /export const GRAPH_SEND_RETRY_BUDGET_MS = 35_000;/);
    assert.match(send, /if \(Date\.now\(\) - startedAt \+ waitMs > GRAPH_SEND_RETRY_BUDGET_MS\) break;/);
  });

  it('son hata adres değil Microsoft geçici hatası der; Mail.Send teşhisi basmaz', () => {
    assert.match(send, /Microsoft geçici olarak yanıt vermedi; mail gitmedi\. Adres sorunu değil\./);
    assert.match(send, /if \(isTransientGraphStatus\(status\)\) \{/);
  });

  it('yanıt ve yeni yazı: gönderim hatası ayrı şerit; kutu kilitlenmez', () => {
    const reply = web('InboxReplyModal.tsx');
    const compose = web('InboxComposeModal.tsx');
    const strip = web('OutboundMailSignalStrip.tsx');
    assert.doesNotMatch(reply, /failed: failedNow/);
    assert.doesNotMatch(compose, /failed: failedNow/);
    assert.match(reply, /<OutboundMailSignalStrip signal=\{signal\} sendError=\{failedNow\} \/>/);
    assert.match(compose, /<OutboundMailSignalStrip signal=\{signal\} sendError=\{failedNow\} \/>/);
    assert.doesNotMatch(reply, /signal === 'replied' \|\| signal === 'failed'/);
    assert.match(strip, /Mail gitmedi\. Adres geri çevirmedi/);
    assert.match(strip, /Kutu maili geri çevirdi\. Adresi kontrol edip yeniden gönderin\./);
  });
});
