/**
 * Acil / gelen kutu yanıtı: geçmiş kalır, logo yığını düşer.
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/inbox-reply-quote.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  buildInboxReplyHtml,
  buildInboxReplyQuotePreview,
  stripEmailLogosAndRepeat,
} from './inbox-reply-quote.ts';

const SAFRAN_PILE = `
<p>7200tl+kdv dir.</p>
<img src="cid:logo1" alt="SAFRAN">
<img src="https://cdn.example/safran.png" alt="SAFRAN">
<img src="https://cdn.example/safran.png" alt="SAFRAN">
<img src="https://cdn.example/linkedin.png" alt="linkedin">
<p>SAFRAN ASISTANS HIZMETLERI</p>
<img src="https://cdn.example/safran.png" alt="SAFRAN">
<p>SAFRAN ASISTANS HIZMETLERI</p>
<blockquote>
  <p>Cam değişimi için teklif bekliyoruz.</p>
  <img src="https://cdn.example/safran.png" alt="SAFRAN">
  <p>SAFRAN ASISTANS HIZMETLERI</p>
</blockquote>
`;

describe('gelen kutu yanıt yazışma geçmişi LOCK', () => {
  it('logoları ve tekrarlayan imzayı keser; asıl yazı bir kez kalır', () => {
    const cleaned = stripEmailLogosAndRepeat(SAFRAN_PILE);
    assert.match(cleaned, /7200tl\+kdv dir/i);
    assert.match(cleaned, /Cam değişimi için teklif bekliyoruz/i);
    assert.equal((cleaned.match(/SAFRAN ASISTANS HIZMETLERI/gi) ?? []).length, 1);
    assert.doesNotMatch(cleaned, /<img/i);
    assert.doesNotMatch(cleaned, /cdn\.example\/safran/i);
  });

  it('gönderilen yanıtta yeni yazı ve geçmiş durur; img yok', () => {
    const html = buildInboxReplyHtml({
      replyText: 'Onaylandı, ekibi yönlendiriyoruz.',
      fromName: 'Safran BH -Acil Yardım Operasyon',
      fromAddress: 'acil@safran.example',
      receivedAt: '2026-09-11T12:42:00.000Z',
      subject: 'RE: 978337350/AHMET AKARSU/RCS-20261880878/KONUT CAM',
      bodyHtml: SAFRAN_PILE,
    });
    assert.match(html, /Onaylandı, ekibi yönlendiriyoruz/);
    assert.match(html, /Bu Yazışma Tarafınıza Ulaştığında Lütfen Teyid Ediniz/);
    assert.match(html, /Yazışma geçmişi/);
    assert.match(html, /7200tl\+kdv dir/i);
    assert.match(html, /Cam değişimi/);
    assert.doesNotMatch(html, /<img/i);
    assert.equal((html.match(/SAFRAN ASISTANS HIZMETLERI/gi) ?? []).length, 1);
  });

  it('önizleme logolardan arınmış düz metindir', () => {
    const preview = buildInboxReplyQuotePreview({
      replyText: 'x',
      fromName: 'Safran BH',
      fromAddress: 'acil@safran.example',
      subject: 'RE: KONUT CAM',
      bodyHtml: SAFRAN_PILE,
    });
    assert.match(preview, /Kimden: Safran BH/);
    assert.match(preview, /7200tl\+kdv dir/i);
    assert.doesNotMatch(preview, /<img/i);
  });

  it('yanıt gönderimi Graph comment ile orijinal logolu HTML yapıştırmaz', () => {
    const send = readFileSync(
      new URL('../../../apps/backend/src/modules/operation-inbox/graph/graph-mail-send.service.ts', import.meta.url),
      'utf8',
    );
    assert.match(send, /messages\/\$\{graphMessageId\}\/\$\{action\}/);
    assert.doesNotMatch(send, /comment:/);
  });

  it('dosya yanıtı ortak biçimleyiciyi kullanır', () => {
    const service = readFileSync(
      new URL('../../../apps/backend/src/modules/operation-inbox/operation-inbox.service.ts', import.meta.url),
      'utf8',
    );
    assert.match(service, /buildInboxReplyHtml/);
    const modal = readFileSync(
      new URL('../../../apps/web/src/components/operation-inbox/InboxReplyModal.tsx', import.meta.url),
      'utf8',
    );
    assert.match(modal, /buildInboxReplyQuotePreview/);
    assert.match(modal, /Alıcıda yazışma geçmişi/);
  });
});
