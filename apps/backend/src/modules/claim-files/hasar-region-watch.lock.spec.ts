/**
 * Hasar bölge maili: dosya sorumlusu ayrı, bölge personeli ayrı; istisna konu.
 * Çalıştır: node --experimental-strip-types --test \
 *   apps/backend/src/modules/claim-files/hasar-region-watch.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

describe('hasar bölge izi mail LOCK', () => {
  it('yeni dosyada bölge izi gider; konu istisnası kapsamı keser', () => {
    const files = readFileSync(join(here, 'claim-files.service.ts'), 'utf8');
    assert.match(files, /notifyHasarRegionWatchers/);
    assert.match(files, /findMatchingResponsibleUsers/);
    assert.match(files, /Bölge Hasar personeli/);
    assert.match(files, /HASAR_ONARIM/);
    assert.match(files, /resolveHasarDepartmentId/);
    const createFn = files.slice(files.indexOf('async create('), files.indexOf('async update('));
    assert.match(createFn, /this\.notifyHasarRegionWatchers/);
    const region = readFileSync(
      join(here, '../claim-responsibilities/claim-responsibilities.service.ts'),
      'utf8',
    );
    assert.match(region, /hasarResponsibilityCoversSubject/);
    assert.match(region, /findMatchingResponsibleUsers/);
  });
});
