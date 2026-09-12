/**
 * Dosya sorumlusu görünür kopya (CC) + baştaki not.
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/file-owner-mail-copy.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  buildCrmSenderCopyNotice,
  buildFileOwnerCopyNotice,
  prependFileOwnerCopyNotice,
} from './file-owner-mail-copy.ts';

describe('dosya sorumlusu mail kopyası LOCK', () => {
  it('notta kopya adresi açık yazar; gizli kopya yok', () => {
    const notice = buildFileOwnerCopyNotice({
      counterpartName: 'Safran BH',
      counterpartAddress: 'acil@safran.example',
      owner: { name: 'Ayşe Ofis', email: 'ayse@meridyen-tr.com' },
    });
    assert.match(notice.plain, /platform üzerinden gönderilmiştir/);
    assert.match(notice.plain, /Karşı taraf: Safran BH · acil@safran.example/);
    assert.match(notice.plain, /Dosya sorumlusu kopyası: Ayşe Ofis \(ayse@meridyen-tr.com\)/);
    assert.match(notice.html, /ayse@meridyen-tr.com/);
    assert.doesNotMatch(notice.html, /bcc/i);
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
    assert.match(notice.plain, /Gönderen kopyası/);
    assert.doesNotMatch(notice.plain, /Dosya sorumlusu kopyası/);
  });

  it('gönderim görünür CC kullanır; popup kopyayı gösterir', () => {
    const send = readFileSync(
      new URL('../../../apps/backend/src/modules/operation-inbox/graph/graph-mail-send.service.ts', import.meta.url),
      'utf8',
    );
    assert.match(send, /ccRecipients/);
    assert.doesNotMatch(send, /bccRecipients/);
    const modal = readFileSync(
      new URL('../../../apps/web/src/components/operation-inbox/InboxReplyModal.tsx', import.meta.url),
      'utf8',
    );
    assert.match(modal, /Görünür kopya/);
    assert.match(modal, /fileOwnerCopy/);
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
