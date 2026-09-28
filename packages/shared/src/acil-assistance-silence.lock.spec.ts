/**
 * Acil asistans sessizliği: Hasar eksper kuyruğu değil; 2 gündür ihbar gelmeyişi.
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/acil-assistance-silence.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isExpertFirmCustomer } from './repair-report-expert.ts';
import { evaluateAssistanceWork } from './crm-expert-silence.ts';
import {
  ACIL_SILENCE_CRM_HREF,
  ACIL_SILENCE_FOLLOW_UP_TITLE,
  ACIL_SILENCE_LIST_HREF,
  ACIL_SILENCE_STRIP_CLICK,
  ACIL_SILENCE_STRIP_HINT,
  ACIL_SILENCE_STRIP_TITLE,
  acilSilenceDismissStorageKey,
  isAssistanceFirmCustomer,
} from './acil-assistance-silence.ts';

const now = new Date('2026-09-28T12:00:00.000Z');

describe('Acil asistans sessizlik kilidi', () => {
  it('asistans kartını tanır; eksper kartına karışmaz', () => {
    assert.equal(isAssistanceFirmCustomer({ subType: 'asistan_firmasi' }), true);
    assert.equal(isAssistanceFirmCustomer({ subType: 'eksper_firmasi' }), false);
    assert.equal(isExpertFirmCustomer({ subType: 'asistan_firmasi', type: 'corporate' }), false);
    assert.equal(isExpertFirmCustomer({ subType: 'eksper_firmasi', type: 'corporate' }), true);
  });

  it('2 gündür ihbar yoksa sessizdir; açık dosya bunu kapatmaz', () => {
    const work = evaluateAssistanceWork({
      fileCount: 4,
      openFileCount: 1,
      lastFileAt: '2026-09-26T00:00:00.000Z',
      now,
    });
    assert.equal(work.silent, true);
    assert.equal(work.lane, 'silent');
    assert.equal(work.followUpTitle, ACIL_SILENCE_FOLLOW_UP_TITLE);
  });

  it('CRM acil süzgecine ve operasyon listesine gider', () => {
    assert.match(ACIL_SILENCE_CRM_HREF, /scope=acil/);
    assert.match(ACIL_SILENCE_CRM_HREF, /lane=silent/);
    assert.equal(ACIL_SILENCE_LIST_HREF, '/panel/operasyon?filter=acil');
    assert.equal(ACIL_SILENCE_STRIP_TITLE, 'Sessiz Müşteri Uyarı');
    assert.equal(ACIL_SILENCE_STRIP_CLICK, 'Tıklayınız');
    assert.match(ACIL_SILENCE_STRIP_HINT, /İhbar Akış Hızı/);
    assert.match(acilSilenceDismissStorageKey('2026-09-28'), /^acil-sessiz-uyari-kapat:/);
  });
});
