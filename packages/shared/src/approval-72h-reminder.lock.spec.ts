/**
 * Kilit: 72s hatırlatma otomatik müşteriye gitmez; broker/eksper tercihtir; Doğanlar varsayılan değil.
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/approval-72h-reminder.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  APPROVAL_72H_FROM_DISPLAY_NAME,
  APPROVAL_72H_OWNER_PROMPT_BODY,
  APPROVAL_72H_OWNER_RELATION_BODY,
  buildApproval72hOwnerRelationNote,
  buildApproval72hOwnerDialogMessage,
  buildApproval72hReminderRecipients,
  filterConfirmedApproval72hEmails,
  shouldPromptApproval72hAgain,
} from '../dist/approval-72h-reminder.js';
import { APPROVAL_72H_MS } from '../dist/operation-status.js';

const here = dirname(fileURLToPath(import.meta.url));

describe('72s onay hatırlatması — dosya sorumlusu kapısı LOCK', () => {
  it('Hasar Tespit alıcıları broker/eksper/sigorta; müşteri kartı listede yok', () => {
    const rows = buildApproval72hReminderRecipients({
      serviceKind: 'inspection',
      insuranceCompany: { name: 'Allianz Sigorta', contactEmail: 'onay@allianz.example' },
      channelBrokerCustomer: {
        companyName: 'Howden Broker',
        email: 'broker@howden.example',
      },
      channelExpertCustomer: {
        companyName: 'Sezgi Eksper',
        email: 'eksper@sezgi.example',
      },
    });
    const emails = rows.map((r) => r.email.toLowerCase());
    assert.ok(emails.includes('broker@howden.example'));
    assert.ok(emails.includes('eksper@sezgi.example'));
    assert.ok(emails.includes('onay@allianz.example'));
    assert.equal(emails.some((e) => e.includes('doganlar')), false);
    const preferred = rows.find((r) => r.preferred);
    assert.ok(preferred);
    assert.equal(preferred!.party === 'broker' || preferred!.party === 'expert', true);
  });

  it('Doğanlar Holding müşteri kartı alıcı üretilmez', () => {
    const rows = buildApproval72hReminderRecipients({
      serviceKind: 'inspection',
      insuranceCompany: { name: 'Allianz', contactEmail: 'a@allianz.example' },
      channelBrokerCustomer: { companyName: 'Broker', email: 'b@broker.example' },
    });
    assert.equal(rows.every((r) => !/doğanlar|doganlar/i.test(r.name)), true);
    assert.equal(rows.some((r) => r.party === 'broker'), true);
  });

  it('yalnız işaretlenen izinli adresler gider', () => {
    const allowed = [
      { email: 'broker@x.com' },
      { email: 'eksper@y.com' },
    ];
    assert.deepEqual(
      filterConfirmedApproval72hEmails(['broker@x.com', 'musteri@doganlar.com'], allowed),
      ['broker@x.com'],
    );
    assert.deepEqual(filterConfirmedApproval72hEmails([], allowed), []);
  });

  it('72 saat dolmadan yeniden uyarı yok', () => {
    const now = new Date('2026-11-20T12:00:00Z');
    assert.equal(shouldPromptApproval72hAgain(null, now), true);
    assert.equal(
      shouldPromptApproval72hAgain(new Date(now.getTime() - APPROVAL_72H_MS + 60_000), now),
      false,
    );
    assert.equal(
      shouldPromptApproval72hAgain(new Date(now.getTime() - APPROVAL_72H_MS - 1), now),
      true,
    );
  });

  it('pencerede dosya no ve sigortalı açık yazar', () => {
    const msg = buildApproval72hOwnerDialogMessage({
      fileNo: '2026 YE 1988/1',
      insuredName: 'Ahmet Yılmaz',
    });
    assert.match(msg, /^Dosya No: 2026 YE 1988\/1/);
    assert.match(msg, /Sigortalı: Ahmet Yılmaz/);
    assert.match(msg, /hatırlatma maili gönderilsin mi/i);
  });

  it('gönderen adı Meridyen; otomatik müşteri maili yok', () => {
    assert.equal(APPROVAL_72H_FROM_DISPLAY_NAME, 'Meridyen');
    assert.match(APPROVAL_72H_OWNER_PROMPT_BODY, /hatırlatma maili gönderilsin mi/i);
    assert.match(
      buildApproval72hOwnerRelationNote({ lastName: 'Güngör' }),
      /^Sn\. Güngör, yalnız mail ile yapılan onay talepleri/,
    );
    assert.match(APPROVAL_72H_OWNER_RELATION_BODY, /red riskini yükseltir/);
    assert.match(
      buildApproval72hOwnerRelationNote({}),
      /^Sn\. meslektaşımız,/,
    );

    const scheduler = readFileSync(
      join(here, '../../../apps/backend/src/modules/claim-files/approval-72h.scheduler.ts'),
      'utf8',
    );
    assert.doesNotMatch(scheduler, /onApproval72hCustomerReminder/);
    assert.doesNotMatch(scheduler, /resolveApproval72hCustomerEmailPayload/);
    assert.match(scheduler, /APPROVAL_72H_NOTIFY_TYPE/);
    assert.match(scheduler, /resolveNotifyUserIds/);

    const graph = readFileSync(
      join(here, '../../../apps/backend/src/modules/operation-inbox/graph/graph-mail-send.service.ts'),
      'utf8',
    );
    assert.match(graph, /fromDisplayName/);
    assert.match(graph, /Meridyen/);

    const page = readFileSync(
      join(here, '../../../apps/web/src/app/panel/hasar-dosyalari/[id]/page.tsx'),
      'utf8',
    );
    assert.match(page, /Approval72hReminderDialog/);
    assert.match(page, /onay-hatirlat/);
  });
});
