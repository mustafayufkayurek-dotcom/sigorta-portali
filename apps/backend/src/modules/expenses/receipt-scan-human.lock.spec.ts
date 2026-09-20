/**
 * Yapay zeka okur; tutar kaydı ve gönderim personeldedir.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/modules/expenses/receipt-scan-human.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

describe('fiş okuma insan kilidi LOCK', () => {
  it('okuma masraf kaydı açmaz; personel kaydeder', () => {
    const scan = readFileSync(join(here, 'receipt-scan.util.ts'), 'utf8');
    const service = readFileSync(join(here, 'expenses.service.ts'), 'utf8');
    const controller = readFileSync(join(here, 'expenses.controller.ts'), 'utf8');
    assert.match(scan, /alanları kontrol edip kaydedin/);
    assert.match(service, /async scanReceipt/);
    assert.doesNotMatch(service.slice(service.indexOf('async scanReceipt')), /this\.prisma\.expense\.create/);
    assert.match(controller, /@Post\('scan-receipt'\)/);
    const scanStart = controller.indexOf("scan-receipt");
    const scanFn = controller.slice(scanStart, controller.indexOf('@Post()', scanStart));
    assert.match(scanFn, /this\.service\.scanReceipt/);
    assert.doesNotMatch(scanFn, /this\.service\.create/);
  });
});
