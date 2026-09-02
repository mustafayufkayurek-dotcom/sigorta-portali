/**
 * Kilit: aylık anket raporu otomatik gitmez; yönetici onayı şart; logo 120px.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/modules/surveys/survey-monthly-report.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'url';

const specDir = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(join(specDir, rel), 'utf8');

describe('aylık anket raporu LOCK', () => {
  it('scheduler mail göndermez, hazırlık sorusu açar', () => {
    const src = read('survey-report.scheduler.ts');
    assert.match(src, /getOrPrepareMonthlyDispatch/);
    assert.doesNotMatch(src, /sendMonthlyReports/);
  });

  it('personel isteyebilir; yönetici olmayan gönderemez', () => {
    const svc = read('survey-report.service.ts');
    assert.match(svc, /requestMonthlySend/);
    assert.match(svc, /approveMonthlySend/);
    assert.match(svc, /Yönetici onayı olmadan anket raporu gönderilemez/);
    assert.match(svc, /canApproveSurveyMonthlyReport/);
    assert.match(svc, /code === 'admin' \|\| code === 'manager'/);
    const ctrl = read('surveys.controller.ts');
    assert.match(ctrl, /monthly-report\/request-send/);
    assert.match(ctrl, /monthly-report\/approve-send/);
  });

  it('ay sonu raporu sigorta, asistans, eksper ve broker alıcılarına gider', () => {
    const svc = read('survey-report.service.ts');
    assert.match(svc, /collectMonthlyReportTargets/);
    assert.match(svc, /asistan_firmasi/);
    assert.match(svc, /eksper_firmasi/);
    assert.match(svc, /broker_firmasi/);
    assert.match(svc, /assistance_company_user/);
    assert.match(svc, /broker_user/);
    assert.match(svc, /role: \{ code: 'expert' \}/);
    const card = read(
      '../../../../web/src/app/panel/anketler/sonuclar/_components/MonthlySurveyReportAskCard.tsx',
    );
    assert.match(card, /asistans, eksper ve broker/);
  });

  it('anket raporunda canlı logo 120px durur; 196px yok; parantez Meridyen yok', () => {
    const src = read('survey-report.template.ts');
    assert.match(src, /width="120"/);
    assert.match(src, /width:120px/);
    assert.match(src, /resolveWelcomeEmailLogoUrl/);
    assert.match(src, /Müdahale hızı/);
    assert.doesNotMatch(src, /196px/);
    assert.doesNotMatch(src, /Meridyen Assistance\)/);
  });

  it('dış onay ve şifre sıfırlama canlı kabukla aynı 120px logoyu kullanır', () => {
    const chrome = read('../notifications/email/email.template.ts');
    assert.match(chrome, /export function buildTransactionalEmailHtml/);
    assert.match(chrome, /width="120"/);
    assert.match(chrome, /width:120px/);
    assert.match(chrome, /export function formatSnPersonGreeting/);
    assert.match(chrome, /export function organizationLineForMail/);
    assert.match(chrome, /isMeridyenStaffRole/);
    assert.match(chrome, /Onay Gönderim tarihi/);
    assert.doesNotMatch(chrome, />Rapor No</);
    const auth = read('../auth/auth.service.ts');
    assert.match(auth, /buildTransactionalEmailHtml/);
    assert.match(auth, /formatSnPersonGreeting/);
    assert.match(auth, /resolvePasswordResetOrganization/);
    assert.match(auth, /isMeridyenStaffRole/);
    const ext = read('../external-approvals/external-approvals.service.ts');
    assert.match(ext, /buildTransactionalEmailHtml/);
    assert.match(ext, /formatSnPersonGreeting/);
    assert.match(ext, /organizationLineForMail/);
    assert.match(ext, /buildExternalApprovalSummaryHtml/);
    assert.match(ext, /title: 'Onay Talep'/);
    assert.match(ext, /onarimRaporuRequestSubject/);
    assert.match(ext, /Hasar onarım raporu onay ve görüşleriniz beklemektedir/);
    assert.match(ext, /sendExpertApprovedStaffEmail/);
    assert.match(ext, /raporOnaylandiSubject/);
    assert.match(ext, /Eksper onarım raporunu onaylanmıştır/);
    assert.match(ext, /Operasyon planlama aşamasına geçiniz/);
    assert.doesNotMatch(ext, /Hasar Onarım Raporu Onay Talebi/);
    assert.doesNotMatch(ext, /Operasyon Bildirimi/);
    assert.match(chrome, /joinMailSubjectParts\(insuranceCompanyName, fileNo, 'Onay Talep'\)/);
    assert.match(chrome, /joinMailSubjectParts\('Rapor Onaylandı'/);
    assert.doesNotMatch(chrome, /'Onarım Raporu'/);
  });
});
