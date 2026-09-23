/**
 * Acil / gelen kutu yanıtı: geçmiş kalır, logo yığını düşer.
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/inbox-reply-quote.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  DOSYA_YAZISMALARI_LABEL,
  buildInboxReplyHtml,
  buildInboxReplyQuotePreview,
  formatCorrespondenceWhen,
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

const OUTLOOK_PILE = `
<p>Cam değişimi için teklif bekliyoruz.</p>
<p>Gönderen: Tuğçe İşlek</p>
<p>Gönderildi: 16 Eylül 2026 Çarşamba 14:05</p>
<p>Kime: ihbar@meridyen.example</p>
<p>Konu: RE: Hayriye Çiftçi / RCS-20261834007 / Konut Cam</p>
<p>Android için Outlook</p>
<p>7200tl+kdv dir.</p>
<p>KONUT HASAR İHBAR FORMU</p>
<p>Sigorta Şirketi: Anadolu</p>
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

  it('gönderilen yanıtta yeni yazı ve geçmiş durur; karşı taraf img yok', () => {
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
    assert.match(html, /Yeni Yazı/);
    assert.match(html, new RegExp(DOSYA_YAZISMALARI_LABEL));
    assert.doesNotMatch(html, /Yazışma geçmişi/);
    assert.match(html, /7200tl\+kdv dir/i);
    assert.match(html, /Cam değişimi/);
    assert.match(html, /RCS-20261880878/);
    assert.match(html, /AHMET AKARSU|Ahmet Akarsu/i);
    assert.doesNotMatch(html, /cdn\.example\/safran/i);
    assert.doesNotMatch(html, /<img/i);
    assert.equal((html.match(/SAFRAN ASISTANS HIZMETLERI/gi) ?? []).length, 1);
  });

  it('Outlook başlık yığınını kartlara ayırır; tarih saat ve ayraç durur', () => {
    const html = buildInboxReplyHtml({
      replyText: 'Teklifi aldık.',
      fromName: 'Safran BH',
      receivedAt: '2026-09-16T11:05:00.000Z',
      subject: 'RE: Hayriye Çiftçi / RCS-20261834007 / Konut Cam',
      bodyHtml: OUTLOOK_PILE,
    });
    assert.match(html, /Dosya Yazışmaları/);
    assert.match(html, /------/);
    assert.match(html, /Tuğçe İşlek/);
    assert.match(html, /16\.09\.2026 14:05/);
    assert.doesNotMatch(html, /Android için Outlook/i);
    assert.doesNotMatch(html, /KONUT HASAR İHBAR FORMU/i);
    assert.match(html, /<svg /);
  });

  it('yalnız Meridyen logosu başlığa konur', () => {
    const html = buildInboxReplyHtml({
      replyText: 'Merhaba',
      logoUrl: 'https://app.meridyen-tr.com/docs/meridyen-logo-original.png',
    });
    assert.match(html, /<img src="https:\/\/app\.meridyen-tr\.com\/docs\/meridyen-logo-original\.png"/);
    const foreign = buildInboxReplyHtml({
      replyText: 'Merhaba',
      logoUrl: 'https://cdn.example/safran.png',
    });
    assert.doesNotMatch(foreign, /<img/i);
  });

  it('gönderim tarihini gün ve saat olarak yazar', () => {
    assert.equal(formatCorrespondenceWhen('16 Eylül 2026 Çarşamba 14:05'), '16.09.2026 14:05');
    assert.equal(formatCorrespondenceWhen('16.09.2026 14:05'), '16.09.2026 14:05');
  });

  it('önizleme logolardan arınmış düz metindir', () => {
    const preview = buildInboxReplyQuotePreview({
      replyText: 'x',
      fromName: 'Safran BH',
      fromAddress: 'acil@safran.example',
      subject: 'RE: KONUT CAM',
      bodyHtml: SAFRAN_PILE,
    });
    assert.match(preview, /Safran BH/);
    assert.match(preview, /7200tl\+kdv dir/i);
    assert.doesNotMatch(preview, /<img/i);
    assert.doesNotMatch(preview, /Kimden:/);
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
    assert.match(service, /resolveWelcomeEmailLogoUrl/);
    const modal = readFileSync(
      new URL('../../../apps/web/src/components/operation-inbox/InboxReplyModal.tsx', import.meta.url),
      'utf8',
    );
    assert.match(modal, /buildInboxReplyQuotePreview/);
    assert.match(modal, /Alıcıda yazışma geçmişi/);
  });
});
