import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const here = dirname(fileURLToPath(import.meta.url));

describe('customer approval notice lock', () => {
  it('onaylanan bedel + müşteri maili kapısı durur', () => {
    const service = readFileSync(join(here, 'repair-reports.service.ts'), 'utf8');
    const controller = readFileSync(join(here, 'repair-reports.controller.ts'), 'utf8');
    const dto = readFileSync(join(here, 'dto/repair-reports.dto.ts'), 'utf8');
    const email = readFileSync(
      join(here, '../notifications/email/claim-event-email.service.ts'),
      'utf8',
    );
    assert.match(controller, /notify-customer-approval/);
    assert.match(service, /notifyCustomerApproval/);
    assert.match(service, /customer_approval_notified/);
    assert.match(dto, /NotifyCustomerApprovalDto/);
    assert.match(email, /onCustomerFileApprovalNotice/);
    assert.match(email, /Dosyanıza Onay Alınmıştır/);
    assert.match(email, /Dosya Adı/);
    assert.match(email, /İl \/ İlçe/);
    assert.match(email, /mailbox:\s*'HASAR'/);
    assert.match(service, /claimFilePlaceLabel/);
    assert.match(service, /insuredName/);
  });

  it('gönderimden önce personel onayı istenir', () => {
    const page = readFileSync(
      join(
        here,
        '../../../../web/src/app/panel/hasar-dosyalari/[id]/onarim-raporu/[reportId]/page.tsx',
      ),
      'utf8',
    );
    assert.match(
      page,
      /Müşteriye Onay Bildirimi Yapılacaktır\. Onaylıyor musunuz\?/,
    );
    assert.match(page, /handleNotifyCustomerApproval/);
  });
});
