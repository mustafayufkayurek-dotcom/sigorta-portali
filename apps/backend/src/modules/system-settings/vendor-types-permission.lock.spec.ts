/**
 * Kilit: Tedarikçi türü listesi settings.view olmadan da okunur (Acil / dosya sorumlusu).
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/modules/system-settings/vendor-types-permission.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

describe('tedarikçi türü yetki LOCK', () => {
  it('GET vendor-types vendor.view veya vendor.create ile açılır', () => {
    const ctrl = readFileSync(join(here, 'system-settings.controller.ts'), 'utf8');
    const start = ctrl.indexOf("@Get('vendor-types')");
    assert.ok(start >= 0);
    const block = ctrl.slice(start, start + 280);
    assert.match(block, /vendor\.view/);
    assert.match(block, /vendor\.create/);
    assert.match(block, /settings\.view/);
  });

  it('liste boşsa varsayılan türler döner', () => {
    const src = readFileSync(join(here, 'system-settings.service.ts'), 'utf8');
    const start = src.indexOf('async getVendorTypes');
    const end = src.indexOf('async setVendorTypes');
    assert.ok(start >= 0 && end > start);
    const fn = src.slice(start, end);
    assert.match(fn, /Taşeron/);
    assert.match(fn, /Malzeme/);
    assert.match(fn, /Lojistik/);
    assert.match(fn, /Ekipman/);
    assert.match(fn, /Diğer/);
  });
});
