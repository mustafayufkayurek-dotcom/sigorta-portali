/**
 * CRM tanıtım maili izi: görünür gönderen kopyası, ulaşmadı, yanıt geldi. Sahte okundu yok.
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/crm-mail-watch.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { buildCrmSenderCopyNotice } from './file-owner-mail-copy.ts';
import {
  canSendVisibleCopy,
  crmMailWatch,
  matchCrmEmailWatchLog,
} from './crm-mail-watch.ts';

describe('CRM tanıtım maili izi LOCK', () => {
  it('gönderen kopyası görünür; dosya sorumlusu metni yok', () => {
    const notice = buildCrmSenderCopyNotice({
      counterpartName: 'Aday Firma',
      counterpartAddress: 'iletisim@aday.example',
      sender: { name: 'Ayşe Ofis', email: 'ayse@meridyen-tr.com' },
    });
    assert.match(notice.plain, /Gönderen kopyası: Ayşe Ofis \(ayse@meridyen-tr.com\)/);
    assert.match(notice.plain, /Alındı/);
    assert.doesNotMatch(notice.plain, /Dosya sorumlusu/);
  });

  it('ortak kutu ve alıcıya kopya gitmez', () => {
    assert.equal(canSendVisibleCopy('hasar@safranbh.com'), false);
    assert.equal(canSendVisibleCopy('ihbar@safranbh.com'), false);
    assert.equal(canSendVisibleCopy('ayse@meridyen-tr.com', ['ayse@meridyen-tr.com']), false);
    assert.equal(canSendVisibleCopy('ayse@meridyen-tr.com', ['iletisim@aday.example']), true);
  });

  it('ulaşmadı ve yanıt eşler; okundu yazılmaz', () => {
    const logs = [
      {
        id: 'a',
        payload: {
          to: 'iletisim@aday.example',
          subject: 'Tanıtım',
          sentAt: '2026-09-12T08:00:00.000Z',
        },
      },
    ];
    assert.equal(
      matchCrmEmailWatchLog(logs, {
        kind: 'failed',
        subject: 'Undeliverable: Tanıtım',
        receivedAt: '2026-09-12T08:05:00.000Z',
      }),
      'a',
    );
    assert.equal(
      matchCrmEmailWatchLog(logs, {
        kind: 'replied',
        fromAddress: 'iletisim@aday.example',
        subject: 'Alındı',
        receivedAt: '2026-09-12T09:00:00.000Z',
      }),
      'a',
    );
    assert.equal(crmMailWatch({ deliveryStatus: 'sent' }), 'sent');
    assert.equal(crmMailWatch({ bouncedAt: '2026-09-12T08:05:00.000Z' }), 'bounced');
    assert.equal(crmMailWatch({ repliedAt: '2026-09-12T09:00:00.000Z' }), 'replied');
  });

  it('CRM gönderimi Hasar kutusundan gider; okundu rozeti yok', () => {
    const crm = readFileSync(
      new URL('../../../apps/backend/src/modules/crm/crm.service.ts', import.meta.url),
      'utf8',
    );
    assert.match(crm, /mailbox:\s*'HASAR'/);
    assert.match(crm, /buildCrmSenderCopyNotice/);
    assert.match(crm, /applyOutboundMailWatch/);
    assert.doesNotMatch(crm, /mailbox:\s*'IHBAR'/);
    const page = readFileSync(
      new URL('../../../apps/web/src/app/panel/crm/page.tsx', import.meta.url),
      'utf8',
    );
    assert.match(page, /CrmMailWatchStrip/);
    assert.match(page, /E-posta Ulaşmadı/);
    assert.match(page, /E-posta Yanıt Geldi/);
    assert.doesNotMatch(page, /Okundu/);
    const strip = readFileSync(
      new URL('../../../apps/web/src/components/crm/CrmMailWatchStrip.tsx', import.meta.url),
      'utf8',
    );
    assert.match(strip, /Ulaşmadı/);
    assert.match(strip, /Yanıt geldi/);
    assert.doesNotMatch(strip, /Okundu/);
    const ingest = readFileSync(
      new URL(
        '../../../apps/backend/src/modules/operation-inbox/processors/inbound-ingest.processor.ts',
        import.meta.url,
      ),
      'utf8',
    );
    assert.match(ingest, /applyOutboundMailWatch/);
    assert.match(ingest, /mapped\.receivedAt instanceof Date/);
  });
});
