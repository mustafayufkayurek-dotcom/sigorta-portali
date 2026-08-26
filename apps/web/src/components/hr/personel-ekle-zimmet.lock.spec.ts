/**
 * Personel Ekle sağ formunda zimmet aynı kayıtta zorunludur.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/components/hr/personel-ekle-zimmet.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

describe('personel ekle zimmet LOCK', () => {
  it('Personel Ekle formunda zimmet zorunludur ve aynı kayıtta gider', () => {
    const ekle = readFileSync(join(here, 'PersonelEklePanel.tsx'), 'utf8');
    assert.match(ekle, /aria-label="Zimmet marka"/);
    assert.match(ekle, /hr\/assets/);
    assert.match(ekle, /Zimmet zorunludur/);
  });
});
