/**
 * Kilit: Memnun Değilim yanıtında açıklama zorunlu.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/modules/surveys/survey-submit.rule.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  surveyDissatisfiedCommentMissing,
  SURVEY_DISSATISFIED_COMMENT_MESSAGE,
} from './survey-submit.rule.ts';

describe('survey submit comment lock', () => {
  it('Memnunum iken açıklama opsiyonel', () => {
    assert.equal(surveyDissatisfiedCommentMissing(true, ''), false);
    assert.equal(surveyDissatisfiedCommentMissing(true, null), false);
    assert.equal(surveyDissatisfiedCommentMissing(true, 'Teşekkürler'), false);
  });

  it('Memnun Değilim iken boş açıklama reddedilir', () => {
    assert.equal(surveyDissatisfiedCommentMissing(false, ''), true);
    assert.equal(surveyDissatisfiedCommentMissing(false, '   '), true);
    assert.equal(surveyDissatisfiedCommentMissing(false, null), true);
    assert.equal(surveyDissatisfiedCommentMissing(false, undefined), true);
  });

  it('Memnun Değilim + açıklama kabul', () => {
    assert.equal(surveyDissatisfiedCommentMissing(false, 'Randevu gecikti'), false);
  });

  it('hata metni Title Case', () => {
    assert.match(SURVEY_DISSATISFIED_COMMENT_MESSAGE, /Memnun Değilim/);
    assert.match(SURVEY_DISSATISFIED_COMMENT_MESSAGE, /Açıklama Zorunludur/);
  });
});
