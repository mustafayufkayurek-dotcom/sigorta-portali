/**
 * Kilit: operasyon maili Microsoft 365 Hasar/İhbar kutusundan gider; SMTP tek başına “gitti” sayılmaz.
 * Rapor dış onayda durum, mail başarısından sonra yazılır.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/modules/notifications/email/outbound-mail.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

describe('operasyon giden mail LOCK', () => {
  it('EmailService Microsoft 365 kutusunu SMTP’den önce dener', () => {
    const src = readFileSync(join(here, 'email.service.ts'), 'utf8');
    assert.match(src, /graphMailSend/);
    assert.match(src, /isOutboundReady/);
    assert.match(src, /via: 'graph'/);
    assert.match(src, /info\.rejected/);
    assert.match(src, /toGraphAttachments/);
    assert.match(src, /mailbox === 'IHBAR'/);
  });

  it('CRM giden maili SMTP bypass etmez', () => {
    const crm = readFileSync(join(here, '../../crm/crm.service.ts'), 'utf8');
    assert.match(crm, /emailService\.sendEmail/);
    assert.doesNotMatch(crm, /nodemailer\.createTransport/);
  });

  it('Graph sendMail PDF ekini taşır; büyük ek kutu gönderimini durdurmaz', () => {
    const src = readFileSync(
      join(here, '../../operation-inbox/graph/graph-mail-send.service.ts'),
      'utf8',
    );
    assert.match(src, /INLINE_ATTACH_MAX_BYTES/);
    assert.match(src, /fileAttachment/);
    assert.match(src, /contentBytes/);
    assert.match(src, /createUploadSession/);
    assert.match(src, /messages\/\$\{messageId\}\/send/);
    assert.match(src, /isOutboundReady/);
  });

  it('dış onayda rapor durumu mail gittikten sonra yazılır', () => {
    const src = readFileSync(
      join(here, '../../external-approvals/external-approvals.service.ts'),
      'utf8',
    );
    const sendMailAt = src.indexOf('await this.sendApprovalEmail');
    const statusAt = src.indexOf("status: 'sent_for_external_approval'");
    assert.ok(sendMailAt > 0 && statusAt > sendMailAt, 'mail önce, durum sonra');
    assert.match(src, /externalApproval\.delete/);
  });
});
