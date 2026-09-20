/**
 * Gelen kutu okur; dışarıya yazı atmaz.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/modules/operation-inbox/inbound-classify-human.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

describe('gelen kutu okuma insan kilidi LOCK', () => {
  it('sınıflandırma mail göndermez', () => {
    const processor = readFileSync(join(here, 'processors/inbound-classify.processor.ts'), 'utf8');
    assert.match(processor, /attemptAutoLink/);
    assert.doesNotMatch(processor, /sendMail/);
    assert.doesNotMatch(processor, /graphMailSend/);
  });
});
