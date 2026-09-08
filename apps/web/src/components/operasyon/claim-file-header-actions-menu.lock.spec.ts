/**
 * Kilit: Dosya üstü üç nokta menüsü kartta kesilmez.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/components/operasyon/claim-file-header-actions-menu.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, 'ClaimFileHeaderActionsMenu.tsx'), 'utf8');

describe('dosya üstü işlemler menüsü LOCK', () => {
  it('menü sayfa üzerine açılır; kart overflow içinde kesilmez', () => {
    assert.match(src, /createPortal/);
    assert.match(src, /fixed z-\[220\]/);
    assert.match(src, /claim-file-actions-dropdown/);
    assert.doesNotMatch(src, /absolute right-0 top-full z-30/);
  });
});
