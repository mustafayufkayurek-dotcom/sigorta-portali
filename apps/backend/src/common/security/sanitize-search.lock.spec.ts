import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sanitizeSearchQuery } from './sanitize-search.ts';

describe('arama süzgeci LOCK', () => {
  it('kontrol karakterini ve fazla uzunluğu keser', () => {
    assert.equal(sanitizeSearchQuery('  AY-1\u0000\n  '), 'AY-1');
    assert.equal(sanitizeSearchQuery('a'.repeat(200)).length, 80);
  });
});
