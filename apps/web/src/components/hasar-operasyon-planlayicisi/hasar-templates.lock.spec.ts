/**
 * Hasar WhatsApp: Hizmet / Hasar / İş satırı Dosya Konusu olur.
 * Çalıştır: node --experimental-strip-types --test \
 *   apps/web/src/components/hasar-operasyon-planlayicisi/hasar-templates.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, 'hasar-templates.ts'), 'utf8');

describe('hasar WhatsApp şablon LOCK', () => {
  it('tedarikçi atamada Dosya Konusu durur; Hizmet/Hasar/İş satır adı çevrilir', () => {
    assert.match(src, /\*Dosya Konusu:\* \{isTanimi\}/);
    assert.match(src, /Hizmet\|Hasar\|İş/);
    assert.doesNotMatch(src, /\nİş: \{isTanimi\}/);
  });
});
