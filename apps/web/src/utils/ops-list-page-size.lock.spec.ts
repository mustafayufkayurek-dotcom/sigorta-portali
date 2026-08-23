/**
 * Çalıştır: node --experimental-strip-types --test apps/web/src/utils/ops-list-page-size.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseOpsListPageSize } from './ops-list-page-size.ts';

describe('liste sayfa boyutu LOCK', () => {
  it('yalnız 20/50/100/150 kabul eder', () => {
    assert.equal(parseOpsListPageSize('50', 20), 50);
    assert.equal(parseOpsListPageSize('150', 20), 150);
    assert.equal(parseOpsListPageSize('7', 20), 20);
    assert.equal(parseOpsListPageSize('abc', 50), 50);
  });
});
