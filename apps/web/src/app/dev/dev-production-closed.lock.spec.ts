/**
 * /dev deneme sayfaları canlıda kapanır; girişsiz örnek ekran açılmaz.
 * Çalıştır: node --experimental-strip-types --test \
 *   apps/web/src/app/dev/dev-production-closed.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const layout = readFileSync(join(here, 'layout.tsx'), 'utf8');

describe('deneme sayfaları canlıda kapalı LOCK', () => {
  it('canlıda /dev notFound; oturum kapısı panel dışına örnek yüz basmaz', () => {
    assert.match(layout, /NODE_ENV === 'production'/);
    assert.match(layout, /notFound\(\)/);
    assert.doesNotMatch(layout, /'use client'/);
  });
});
