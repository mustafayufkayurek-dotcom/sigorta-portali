/**
 * Hasar liste araması — Aydın Ziya Özgür.
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/list-search-tr.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildClaimFileListSearchWhere,
  foldTurkishSearchText,
  nameMatchesListSearch,
  turkishISearchVariants,
} from './list-search-tr.ts';

const NAME = 'Aydın Ziya Özgür';

describe('liste araması Türkçe ad kilidi', () => {
  it('Aydın Ziya Özgür ad, ikinci ad ve soyadla bulunur', () => {
    assert.equal(nameMatchesListSearch(NAME, 'ÖZGÜR'), true);
    assert.equal(nameMatchesListSearch(NAME, 'AYDIN'), true);
    assert.equal(nameMatchesListSearch(NAME, 'Aydin'), true);
    assert.equal(nameMatchesListSearch(NAME, 'ZİYA'), true);
    assert.equal(nameMatchesListSearch(NAME, 'ZIYA'), true);
    assert.equal(nameMatchesListSearch(NAME, 'Aydın Ziya Özgür'), true);
    assert.equal(nameMatchesListSearch(NAME, 'AYDIN OZGUR'), false);
    assert.equal(nameMatchesListSearch(NAME, 'Mehmet'), false);
  });

  it('AYDIN yazınca ı varyantı durur', () => {
    const vars = turkishISearchVariants('AYDIN');
    assert.ok(vars.some((v) => foldTurkishSearchText(v) === foldTurkishSearchText('Aydın')));
    assert.ok(vars.includes('AYDIN') || vars.some((v) => v.includes('ı') || v.includes('I')));
  });

  it('liste sorgusu her kelimeyi AND ile arar', () => {
    const where = buildClaimFileListSearchWhere('AYDIN ZIYA') as {
      OR: Array<{ AND?: unknown[] }>;
    };
    const nameAnd = where.OR.find((part) => Array.isArray(part.AND));
    assert.equal(nameAnd?.AND?.length, 2);
  });
});
