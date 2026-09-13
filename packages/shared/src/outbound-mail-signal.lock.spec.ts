/**
 * Giden mail sinyal: gönderildi / okunmadı / okundu. Sahte okundu yok.
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/outbound-mail-signal.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  buildMailReceiptDisplay,
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
    assert.equal(
      classifyMailReceipt({
        subject: 'RE: KONUT ANAHTAR',
        bodyText: 'Your message was read on Sunday.',
      }),
      'read',
    );
  });

  it('okundu belgesi Türkçe ve anlaşılır yazılır', () => {
    const display = buildMailReceiptDisplay({
      kind: 'read',
      originalSubject: 'Read: RE: KONUT ANAHTAR',
      seenAt: '2026-09-13T09:13:00.000Z',
    });
    assert.match(display.subject, /^Okundu:/);
    assert.match(display.plain, /Karşı taraf bu yazıyı okudu/);
    assert.match(display.html, /#1e3a5f/);
    assert.doesNotMatch(display.html, /Your message/i);
    assert.doesNotMatch(display.html, /was read on/i);
    const ingest = readFileSync(
      new URL(
        '../../../apps/backend/src/modules/operation-inbox/processors/inbound-ingest.processor.ts',
        import.meta.url,
      ),
      'utf8',
    );
    assert.match(ingest, /buildMailReceiptDisplay/);
    assert.match(ingest, /rewriteMessageDisplay/);
  });

  it('okundu bilgisi istenir; ekranda rozet ve Alındı durur', () => {
    const send = readFileSync(
      new URL('../../../apps/backend/src/modules/operation-inbox/graph/graph-mail-send.service.ts', import.meta.url),
      'utf8',
    );
    assert.match(send, /isReadReceiptRequested:\s*true/);
    assert.doesNotMatch(send, /isReadReceiptRequested:\s*false/);
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
    assert.match(strip, /Karşı taraf yazıyı gördü/);
    const quote = readFileSync(
      new URL('./inbox-reply-quote.ts', import.meta.url),
      'utf8',
    );
    assert.match(quote, /Gördüğünüzde lütfen Alındı yazarak yanıtlayın/);
  });
});
