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

  it('Graph sendMail PDF ekini taşır; taslak ve Mail.ReadWrite personel uyarısı yok', () => {
    const src = readFileSync(
      join(here, '../../operation-inbox/graph/graph-mail-send.service.ts'),
      'utf8',
    );
    assert.match(src, /INLINE_ATTACH_MAX_BYTES/);
    assert.match(src, /fileAttachment/);
    assert.match(src, /contentBytes/);
    assert.match(src, /users\/\$\{encodedUser\}\/sendMail/);
    assert.match(src, /isOutboundReady/);
    assert.match(src, /Mail\.Send yeter/);
    assert.match(src, /sendMailUrl/);
    assert.doesNotMatch(src, /createUploadSession/);
    assert.doesNotMatch(src, /messages\/\$\{messageId\}\/send/);
    assert.doesNotMatch(src, /Mail\.ReadWrite/);
    assert.doesNotMatch(src, /Büyük ek için kutuya taslak yazılamadı/);
    assert.doesNotMatch(src, /yönetici onayı gerekir/);
    assert.doesNotMatch(
      src,
      /E-posta gönderme izni yok\. Azure AD uygulama kaydına Mail\.Send/,
    );
  });

  it('ayarlar test maili SMTP yeşilini gitti saymaz', () => {
    const src = readFileSync(join(here, '../../system-settings/system-settings.service.ts'), 'utf8');
    assert.match(src, /this\.email\.sendEmail/);
    assert.match(src, /via !== 'graph'/);
    assert.doesNotMatch(src, /nodemailer\.createTransport/);
  });

  it('rapor e-postası Hasar kutusu olmadan gitti sayılmaz', () => {
    const src = readFileSync(join(here, '../../repair-reports/email/report-email.service.ts'), 'utf8');
    assert.match(src, /via !== 'graph'/);
    const ext = readFileSync(join(here, '../../external-approvals/external-approvals.service.ts'), 'utf8');
    assert.match(ext, /via !== 'graph'/);
  });

  it('Acil kapanış maili kutu olmadan gitti sayılmaz', () => {
    const src = readFileSync(
      join(here, '../../emergency/emergency-cases.service.ts'),
      'utf8',
    );
    assert.match(src, /sendClosureEmail/);
    assert.match(src, /via !== 'graph'/);
  });

  it('full deploy giden mail kilidini çalıştırır', () => {
    const root = join(here, '../../../../../../');
    const src = readFileSync(join(root, 'scripts/deploy-full-production.sh'), 'utf8');
    assert.match(src, /smoke-outbound-mail\.sh/);
    const pkg = readFileSync(join(root, 'package.json'), 'utf8');
    assert.match(pkg, /"smoke:outbound-mail": "bash scripts\/smoke-outbound-mail\.sh"/);
  });

  it('hoş geldin Kullanıcılar e-postasına gider; kutu yazılmaz (Hasar varsayılan)', () => {
    const users = readFileSync(join(here, '../../users/users.service.ts'), 'utf8');
    const welcome = users.slice(users.indexOf('private async sendWelcomeInviteEmail'));
    const end = welcome.indexOf('\n  private ', 20);
    const block = welcome.slice(0, end > 0 ? end : undefined);
    assert.match(block, /sendWelcomeEmail\(params\.email/);
    assert.doesNotMatch(block, /mailbox:\s*'IHBAR'/);
    const email = readFileSync(join(here, 'email.service.ts'), 'utf8');
    const sendWelcome = email.slice(email.indexOf('async sendWelcomeEmail'));
    const sendWelcomeEnd = sendWelcome.indexOf('\n  async ', 20);
    const welcomeFn = sendWelcome.slice(0, sendWelcomeEnd > 0 ? sendWelcomeEnd : undefined);
    assert.doesNotMatch(welcomeFn, /mailbox:\s*'IHBAR'/);
    assert.match(email, /options\?\.mailbox === 'IHBAR' \? 'IHBAR' : 'HASAR'/);
  });

  it('Hasar dosya işi Hasar kutusundan; Acil kapanış İhbar kutusundan', () => {
    const reports = readFileSync(
      join(here, '../../repair-reports/email/report-email.service.ts'),
      'utf8',
    );
    assert.doesNotMatch(reports, /mailbox:\s*'IHBAR'/);
    const ext = readFileSync(join(here, '../../external-approvals/external-approvals.service.ts'), 'utf8');
    assert.match(ext, /mailbox:\s*'HASAR'/);
    const claims = readFileSync(join(here, '../../claim-files/claim-files.service.ts'), 'utf8');
    assert.match(claims, /mailbox:\s*'HASAR'/);
    const emergency = readFileSync(
      join(here, '../../emergency/emergency-cases.service.ts'),
      'utf8',
    );
    const closure = emergency.slice(emergency.indexOf('async sendClosureEmail'));
    assert.match(closure, /mailbox:\s*'IHBAR'/);
    assert.match(emergency, /addEmail\(emergencyCase\.customer\?\.email\)/);
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
