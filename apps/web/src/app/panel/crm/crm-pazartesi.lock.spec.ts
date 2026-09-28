/**
 * CRM pazartesi görüşme: liste kesilmesin, ciro uydurulmasın.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/app/panel/crm/crm-pazartesi.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const page = readFileSync(join(here, 'page.tsx'), 'utf8');

describe('CRM pazartesi kullanım kilidi', () => {
  it('havuz 100 kayıtta kesilmez', () => {
    assert.match(page, /fetchCrmPoolRows/);
    assert.match(page, /getWithMeta/);
    assert.doesNotMatch(page, /get<any\[\]>\('\/customers', \{ limit: 100 \}\)/);
  });

  it('görüşmede ciro uydurulmaz', () => {
    assert.doesNotMatch(page, /Ciro\/kar canlı hafıza/);
    assert.match(page, /Sayı; ciro değildir/);
  });
});
