/**
 * Giden mail sinyal: gönderildi / okunmadı / okundu. Sahte okundu yok.
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/outbound-mail-signal.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  classifyMailReceipt,
  outboundMailSignal,
} from './outbound-mail-signal.ts';

describe('giden mail gönderildi/okundu LOCK', () => {
  it('gönderilmeden okundu yazılmaz', () => {
    assert.equal(outboundMailSignal({}), 'idle');
    assert.equal(outboundMailSignal({ lastReplyAt: '2026-09-12T10:00:00.000Z' }), 'sent');
    assert.equal(
      outboundMailSignal({
        lastReplyAt: '2026-09-12T10:00:00.000Z',
        lastReplyReadAt: '2026-09-12T10:05:00.000Z',
      }),
      'read',
    );
    assert.equal(
      outboundMailSignal({
        lastReplyAt: '2026-09-12T10:00:00.000Z',
        lastCounterpartReplyAt: '2026-09-12T10:06:00.000Z',
      }),
      'replied',
    );
  });

  it('okundu ve iletilemedi bilgisini konu satırından ayırır', () => {
    assert.equal(classifyMailReceipt({ subject: 'Okundu: RE: KONUT CAM' }), 'read');
    assert.equal(classifyMailReceipt({ subject: 'Read: 978337350' }), 'read');
    assert.equal(classifyMailReceipt({ subject: 'Undeliverable: RE: KONUT CAM' }), 'failed');
    assert.equal(classifyMailReceipt({ subject: 'RE: KONUT CAM' }), null);
  });

  it('yanıt isteği okundu bilgisi ister; ekranda iki rozet durur', () => {
    const send = readFileSync(
      new URL('../../../apps/backend/src/modules/operation-inbox/graph/graph-mail-send.service.ts', import.meta.url),
      'utf8',
    );
    assert.match(send, /isReadReceiptRequested:\s*true/);
    const modal = readFileSync(
      new URL('../../../apps/web/src/components/operation-inbox/InboxReplyModal.tsx', import.meta.url),
      'utf8',
    );
    assert.match(modal, /OutboundMailSignalStrip/);
    const strip = readFileSync(
      new URL('../../../apps/web/src/components/operation-inbox/OutboundMailSignalStrip.tsx', import.meta.url),
      'utf8',
    );
    assert.match(strip, /Okunmadı/);
    assert.match(strip, /Okundu/);
    assert.match(strip, /Yanıt geldi/);
    assert.match(strip, /Alındı/);
    const quote = readFileSync(
      new URL('./inbox-reply-quote.ts', import.meta.url),
      'utf8',
    );
    assert.match(quote, /Gördüğünüzde lütfen Alındı yazarak yanıtlayın/);
  });
});
