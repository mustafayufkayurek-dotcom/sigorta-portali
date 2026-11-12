/**
 * Çalıştır: node --experimental-strip-types --test apps/web/src/utils/ops-list-page-size.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parseOpsListPageSize } from './ops-list-page-size.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('liste sayfa boyutu LOCK', () => {
  it('yalnız 20/50/100/150 kabul eder', () => {
    assert.equal(parseOpsListPageSize('50', 20), 50);
    assert.equal(parseOpsListPageSize('100', 20), 100);
    assert.equal(parseOpsListPageSize('150', 20), 150);
    assert.equal(parseOpsListPageSize('7', 20), 20);
    assert.equal(parseOpsListPageSize('abc', 50), 50);
  });

  it('Hasar listesi seçilen boyutu ister; eski dosya ve 150 sunucuda durur', () => {
    const page = readFileSync(
      join(here, '../app/panel/hasar-dosyalari/page.tsx'),
      'utf8',
    );
    const kind = readFileSync(
      join(here, '../../../../packages/shared/src/claim-service-kind.ts'),
      'utf8',
    );
    const api = readFileSync(
      join(here, '../../../../apps/backend/src/modules/claim-files/claim-files.service.ts'),
      'utf8',
    );
    assert.match(page, /limit: String\(limit\)/);
    assert.match(page, /meta\?\.total \?\? claims\.length/);
    assert.match(kind, /serviceKind: null/);
    assert.match(kind, /CLAIM_LIST_PAGE_MAX = 150/);
    assert.match(api, /CLAIM_LIST_PAGE_MAX/);
    assert.doesNotMatch(api, /Number\(params\?\.limit\) \|\| 20, 100/);
  });
});
