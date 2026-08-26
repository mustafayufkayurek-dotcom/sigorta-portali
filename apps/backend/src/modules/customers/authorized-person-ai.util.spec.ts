import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseAuthorizedPersonAiJson } from './authorized-person-ai.util.ts';

describe('yetkili adı yapay zeka denetimi', () => {
  it('kirli kaydı yüksek güvenle işaretler; isim uydurmaz', () => {
    const parsed = parseAuthorizedPersonAiJson(
      '{"verdicts":[{"dirty":true,"confidence":0.95,"suggestedName":"Ahmet Yılmaz"}]}',
      1,
    );
    assert.deepEqual(parsed.dirtyIndexes, [0]);
  });

  it('kişi adını kirli saymaz', () => {
    const parsed = parseAuthorizedPersonAiJson(
      '{"verdicts":[{"dirty":false,"confidence":0.9}]}',
      1,
    );
    assert.deepEqual(parsed.dirtyIndexes, []);
  });

  it('uzunluk uyuşmazsa yok sayar', () => {
    const parsed = parseAuthorizedPersonAiJson(
      '{"verdicts":[{"dirty":true,"confidence":0.99}]}',
      2,
    );
    assert.deepEqual(parsed.dirtyIndexes, []);
  });
});
