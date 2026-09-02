/**
 * Planlayıcı Evrak Yükleme: fiziki file-document kapanış bayrağı.
 * Çalıştır: node --experimental-strip-types --test \
 *   apps/backend/src/modules/claim-files/claim-docs-upload.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

describe('claim operation center docs upload LOCK', () => {
  it('fiziki evrak hasClosureDocuments döner', () => {
    const src = readFileSync(join(here, 'claim-operation-center.service.ts'), 'utf8');
    const start = src.indexOf('private async buildFlowFlags');
    const end = src.indexOf('async upsertMainAppointment');
    assert.ok(start >= 0 && end > start);
    const fn = src.slice(start, end);
    assert.match(fn, /fileDocument\.count/);
    assert.match(fn, /physicalUploadKey/);
    assert.match(fn, /hasClosureDocuments: closureDocCount > 0/);
  });
});
