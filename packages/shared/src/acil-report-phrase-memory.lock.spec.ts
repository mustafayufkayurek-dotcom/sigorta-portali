import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  emptyAcilReportPhraseStore,
  matchAcilReportPhrases,
  rememberAcilReportPhrase,
} from './acil-report-phrase-memory.ts';

describe('acil rapor cümle hafızası LOCK', () => {
  it('c yazınca c ile başlayan cümleler gelir; içerideki c yetmez', () => {
    const phrases = ['Cam değişimi yapıldı', 'Çerçeve sağlam', 'Kapı kilidi söküldü'];
    const hits = matchAcilReportPhrases('c', phrases);
    assert.deepEqual(hits, ['Cam değişimi yapıldı', 'Çerçeve sağlam']);
    assert.equal(matchAcilReportPhrases('ka', phrases)[0], 'Kapı kilidi söküldü');
    assert.equal(matchAcilReportPhrases('x', phrases).length, 0);
  });

  it('yeni cümle başa yazılır; aynı cümle tekrarlanmaz', () => {
    let store = emptyAcilReportPhraseStore();
    store = rememberAcilReportPhrase(store, 'mahal', 'Salon camı');
    store = rememberAcilReportPhrase(store, 'mahal', 'Mutfak');
    store = rememberAcilReportPhrase(store, 'mahal', 'salon camı');
    assert.deepEqual(store.mahal, ['salon camı', 'Mutfak']);
  });
});
