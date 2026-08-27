/**
 * Kilit: Evrak Türleri müşteri tipi sekmeleri; yeni kayıtta EVRAK_ slug yok.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/app/panel/ayarlar/evrak-turleri-musteri-sekme.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'url';

const specDir = dirname(fileURLToPath(import.meta.url));
const page = readFileSync(join(specDir, 'evrak-turleri/page.tsx'), 'utf8');

describe('evrak türleri müşteri sekme LOCK', () => {
  it('müşteri tipi sekmeleri durur', () => {
    assert.match(page, /customerFilterTabs/);
    assert.match(page, /mergeCustomerSubTypes/);
    assert.match(page, /Müşteri Tipi Kapsamı/);
    assert.match(page, /customer-sub-types/);
  });

  it('yeni kayıt adından EVRAK_ slug üretmez', () => {
    assert.doesNotMatch(page, /suggestAutoCode\('EVRAK'/);
    assert.doesNotMatch(page, /applyNameWithAutoCode/);
  });
});
