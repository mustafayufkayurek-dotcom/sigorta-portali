/**
 * Kayıt, kişi adını ikinci bir kararla kesmez.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/modules/customers/authorized-person-save.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const service = readFileSync(join(here, 'customers.service.ts'), 'utf8');

describe('yetkili kişi kayıt LOCK', () => {
  it('kayıt aynı ad kuralını kullanır; ikinci kesme yok', () => {
    assert.match(service, /isDirtyAuthorizedPersonName/);
    assert.match(service, /AUTHORIZED_PERSON_DIRTY_MESSAGE/);
    assert.doesNotMatch(service, /classifyAuthorizedPersonNamesWithAi/);
  });
});
