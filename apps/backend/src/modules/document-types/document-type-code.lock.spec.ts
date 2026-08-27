/**
 * Kilit: Yeni evrak türü kodu DOC-NNNNN; ad slug’ı (EVRAK_…) yok.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/modules/document-types/document-type-code.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

describe('document type sequential code LOCK', () => {
  it('kayıtta yazılım DOC- üretir; istemci slug göndermez', () => {
    const svc = readFileSync(join(here, 'document-types.service.ts'), 'utf8');
    assert.match(svc, /nextDocumentCode/);
    assert.match(svc, /DOC-\$\{String\(max \+ 1\)/);
    const start = svc.indexOf('async create(');
    const end = svc.indexOf('async update(');
    const create = start >= 0 && end > start ? svc.slice(start, end) : '';
    assert.ok(create.length > 0);
    assert.match(create, /const code = await this\.nextDocumentCode/);
    assert.doesNotMatch(create, /dto\.code/);
    const dto = readFileSync(join(here, 'dto/document-types.dto.ts'), 'utf8');
    assert.match(dto, /IsNotEmpty/);
  });
});
