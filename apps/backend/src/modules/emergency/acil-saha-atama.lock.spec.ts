/**
 * Acil dosyada saha operasyonu seçilir; atanan kişi listede durur.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/modules/emergency/acil-saha-atama.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

describe('acil saha atama LOCK', () => {
  it('saha listesi assignedFieldUserId ile açılır; hasar müşteri bağı yoktur', () => {
    const src = readFileSync(join(here, 'emergency-cases.service.ts'), 'utf8');
    assert.match(src, /assignedFieldUserId: requestingUser\.id/);
    assert.doesNotMatch(src, /claimFiles: \{ some: \{ assignedFieldUserId/);
    const dto = readFileSync(join(here, 'dto/update-emergency-case.dto.ts'), 'utf8');
    assert.match(dto, /assignedFieldUserId\?:/);
  });
});
