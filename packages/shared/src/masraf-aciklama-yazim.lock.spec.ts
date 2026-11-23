/**
 * Masraf açıklama yazım — Akatyakıt → Akaryakıt.
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/masraf-aciklama-yazim.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  correctMasrafAciklamaYazim,
  normalizeMasrafAciklamaForSave,
} from './masraf-aciklama-yazim.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('masraf açıklama yazım LOCK', () => {
  it('Akatyakıt → Akaryakıt; doğru yazım bozulmaz', () => {
    assert.equal(
      correctMasrafAciklamaYazim('Akatyakıt Alımı (Bodrum Dönüş)'),
      'Akaryakıt Alımı (Bodrum Dönüş)',
    );
    assert.equal(correctMasrafAciklamaYazim('Akatyakıt Alımı'), 'Akaryakıt Alımı');
    assert.equal(
      correctMasrafAciklamaYazim('Akaryakıt Alımı (Biga Hasar Tespitler İçin)'),
      'Akaryakıt Alımı (Biga Hasar Tespitler İçin)',
    );
    assert.equal(normalizeMasrafAciklamaForSave('  akatyakıt alımı  '), 'akaryakıt alımı');
  });

  it('hatırlama ve kayıt yolu düzeltmeyi kullanır', () => {
    const hatirla = readFileSync(
      join(here, '../../../apps/web/src/utils/masraf-aciklama-hatirla.ts'),
      'utf8',
    );
    const masraf = readFileSync(
      join(here, '../../../apps/web/src/app/panel/finans/masraflar/page.tsx'),
      'utf8',
    );
    const service = readFileSync(
      join(here, '../../../apps/backend/src/modules/expenses/expenses.service.ts'),
      'utf8',
    );
    assert.match(hatirla, /correctMasrafAciklamaYazim|normalizeMasrafAciklamaForSave/);
    assert.match(masraf, /normalizeMasrafAciklamaForSave|correctMasrafAciklamaYazim/);
    assert.match(service, /normalizeMasrafAciklamaForSave|correctMasrafAciklamaYazim/);
  });
});
