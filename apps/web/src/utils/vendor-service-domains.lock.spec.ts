/**
 * Kilit: tedarikçi faaliyet alanı konut / araç ikonları.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/utils/vendor-service-domains.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { resolveVendorServiceDomains } from './vendor-service-domains.ts';

const here = dirname(fileURLToPath(import.meta.url));
const card = readFileSync(
  join(here, '../components/vendor-discovery/VendorCandidateCard.tsx'),
  'utf8',
);

describe('vendor service domains LOCK', () => {
  it('çilingir tek anahtar ikonu üretir', () => {
    assert.deepEqual(resolveVendorServiceDomains(['Konut', 'Araç'], 'Çingir Acil'), ['cilingir']);
    assert.deepEqual(resolveVendorServiceDomains(['Kapı/Kilit Arızası']), ['cilingir']);
    assert.deepEqual(resolveVendorServiceDomains(['Çekici', 'Lastik']), ['arac']);
    assert.deepEqual(resolveVendorServiceDomains(['Konut']), ['konut']);
    assert.deepEqual(resolveVendorServiceDomains([]), ['konut']);
  });

  it('kartta faaliyet ikonları durur', () => {
    assert.match(card, /VendorServiceDomainIcons/);
    assert.match(card, /tel:/);
    assert.match(card, /Phone/);
  });
});
