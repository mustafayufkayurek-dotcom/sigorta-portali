/**
 * Acil tespit bulgusu dosyada kalır; boş PATCH silmez.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/modules/emergency/acil-tespit-bulgusu.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

describe('acil tespit bulgusu LOCK', () => {
  it('update boş findingsText ile mevcut metni silmez', () => {
    const src = readFileSync(join(here, 'emergency-cases.service.ts'), 'utf8');
    const start = src.indexOf('async update(id: string, dto: UpdateEmergencyCaseDto)');
    const end = src.indexOf('private async reportNegativeVendorIfNeeded');
    assert.ok(start >= 0 && end > start);
    const fn = src.slice(start, end);
    assert.match(fn, /nextEmergencyFindingsText/);
    assert.match(fn, /existing\.data\?\.findingsText/);
    assert.doesNotMatch(fn, /dto\.findingsText !== undefined && \{ findingsText: dto\.findingsText \}/);
  });

  it('oluşturmada tespit bulgusu zorunlu', () => {
    const createDto = readFileSync(join(here, 'dto/create-emergency-case.dto.ts'), 'utf8');
    assert.match(createDto, /findingsText/);
    assert.match(createDto, /Tespit Bulguları zorunludur/);
    const updateDto = readFileSync(join(here, 'dto/update-emergency-case.dto.ts'), 'utf8');
    assert.match(updateDto, /findingsText\?: string/);
  });
});
