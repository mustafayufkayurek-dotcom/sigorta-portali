/**
 * Adres metninden Afyon kısa adı.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/modules/operation-inbox/inbound-location.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const util = readFileSync(join(here, 'inbound-location.util.ts'), 'utf8');

describe('inbound location LOCK', () => {
  it('il eşlemesinde kısa ad / alias aranır', () => {
    assert.match(util, /provinceSearchNames/);
    assert.match(util, /labels\.some\(\(label\) => includesPlaceName\(text, label\)\)/);
  });
});
