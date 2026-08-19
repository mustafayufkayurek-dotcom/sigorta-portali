/**
 * Kilit: Anket kapanışta zorunlu değil; ofis uyarısı; Memnun Değilim açıklama; WhatsApp link.
 * Çalıştır: node --experimental-strip-types --test src/utils/survey-closure.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  surveyDissatisfiedCommentMissing,
  surveyLinkSent,
  SURVEY_STAR_QUESTION_LABELS,
  SURVEY_Q6_LABEL,
} from './survey-form.ts';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(join(here, rel), 'utf8');

describe('survey closure UI lock', () => {
  it('Memnun Değilim açıklama kuralı', () => {
    assert.equal(surveyDissatisfiedCommentMissing(true, ''), false);
    assert.equal(surveyDissatisfiedCommentMissing(false, ''), true);
    assert.equal(surveyDissatisfiedCommentMissing(false, 'Geç kaldılar'), false);
  });

  it('gönderilmiş anket uyarılmaz', () => {
    assert.equal(surveyLinkSent(null), false);
    assert.equal(surveyLinkSent({ status: 'pending' }), false);
    assert.equal(surveyLinkSent({ status: 'sent' }), true);
    assert.equal(surveyLinkSent({ status: 'pending', whatsappSentAt: '2026-08-19' }), true);
  });

  it('kamu form ve sonuç çekmecesi aynı soru metinleri', () => {
    const publicPage = read('../app/anket/[token]/page.tsx');
    assert.match(publicPage, /SURVEY_STAR_QUESTIONS/);
    assert.match(publicPage, /surveyDissatisfiedCommentMissing/);
    assert.match(publicPage, /SURVEY_DISSATISFIED_COMMENT_MESSAGE/);
    assert.match(publicPage, /Memnun Değilim/);

    const drawer = read('../app/panel/anketler/sonuclar/_components/SurveyDetailDrawer.tsx');
    assert.match(drawer, /SURVEY_STAR_QUESTION_LABELS/);
    assert.doesNotMatch(drawer, /İletişim Kalitesi/);
    assert.equal(SURVEY_STAR_QUESTION_LABELS.length, 5);
    assert.match(SURVEY_Q6_LABEL, /Memnuniyet/);
  });

  it('kapanış paneli faturaya kilitlenmez; WhatsApp link üretir', () => {
    const panel = read('../components/file-documents/ClosureConditionsPanel.tsx');
    assert.match(panel, /fileClosed/);
    assert.match(panel, /createAndSendSurveyForClaim/);
    assert.match(panel, /WhatsApp Anket Linki Oluştur/);
    assert.match(panel, /Anket zorunlu değildir/);
    assert.doesNotMatch(panel, /if \(!invoicedRequest\) return/);
    assert.match(panel, /showSurvey && \(fileClosed \|\| invoicedRequest \|\| survey\)/);
  });

  it('dosya sorumlusu ana sayfa ve dosya ekranında amber uyarı', () => {
    const office = read('../features/dashboard/components/admin/office-survey-reminder.tsx');
    assert.match(office, /OfficeSurveyReminder/);
    assert.match(office, /InspectionReminderBanner/);
    assert.match(office, /ofis-anket-hatirlatma/);
    assert.match(office, /listClosureUnsentSurveys/);
    assert.match(office, /Dosyaya Git/);
    assert.doesNotMatch(office, /\/notifications/);
    assert.doesNotMatch(office, /openWhatsAppChat/);

    const home = read('../app/panel/page.tsx');
    const officeStart = home.indexOf('if (showOfficeLayout) {');
    const fieldStart = home.indexOf('/** Saha Personeli ana sayfa');
    assert.ok(officeStart >= 0 && fieldStart > officeStart);
    const officeBlock = home.slice(officeStart, fieldStart);
    assert.match(officeBlock, /OfficeSurveyReminder/);

    const banner = read('../components/survey/ClaimSurveyUnsentBanner.tsx');
    assert.match(banner, /dosya-anket-hatirlatma/);
    assert.match(banner, /assignedOfficeUserId/);

    const detail = read('../app/panel/hasar-dosyalari/[id]/page.tsx');
    assert.match(detail, /ClaimSurveyUnsentBanner/);
  });
});
