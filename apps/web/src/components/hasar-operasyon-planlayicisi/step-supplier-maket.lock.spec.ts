/**
 * Kilit: Hasar planlayıcı tedarikçi adımında Boyacı/Kadıköy maketi yok.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/components/hasar-operasyon-planlayicisi/step-supplier-maket.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const steps = readFileSync(join(here, 'steps.tsx'), 'utf8');
const start = steps.indexOf('export function StepSupplier');
const next = steps.indexOf('export function StepWhatsApp');
const supplier = start >= 0 && next > start ? steps.slice(start, next) : '';

describe('hasar planner supplier mock lock', () => {
  it('tedarikçi adımı durur; Boyacı maketi ve sahte havuz kaydı yok', () => {
    assert.ok(supplier.length > 0);
    assert.match(supplier, /Önerilen Tedarikçiler/);
    assert.match(supplier, /Ata/);
    assert.doesNotMatch(supplier, /<option>Boyacı<\/option>/);
    assert.doesNotMatch(supplier, /<option>Kadıköy<\/option>/);
    assert.doesNotMatch(supplier, /useState\('Boyacı'\)/);
    assert.doesNotMatch(supplier, /Havuzuna Kaydet/);
    assert.doesNotMatch(supplier, /setPoolExtra/);
  });
});
