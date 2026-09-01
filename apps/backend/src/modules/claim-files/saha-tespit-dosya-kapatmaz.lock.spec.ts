/**
 * Saha tespitçisi ofis dosyasını kapatamaz.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/modules/claim-files/saha-tespit-dosya-kapatmaz.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

describe('saha tespit ofis dosyasını kapatmaz LOCK', () => {
  it('field-close açık dosyayı closed yapmaz', () => {
    const src = readFileSync(join(here, 'claim-files.service.ts'), 'utf8');
    const start = src.indexOf('async closeAfterFieldInspection');
    const end = src.indexOf('async submitCostReport');
    assert.ok(start >= 0 && end > start);
    const fn = src.slice(start, end);
    assert.match(fn, /BadRequestException/);
    assert.match(fn, /Saha tespiti dosyayı kapatmaz/);
    assert.doesNotMatch(fn, /closedAt/);
    assert.doesNotMatch(fn, /isClosedState:\s*true/);
    assert.doesNotMatch(fn, /ensureCampaignForClaimFile/);
    assert.doesNotMatch(fn, /code:\s*'closed'/);
  });

  it('kapı durur; 400 döner, ofis kapanışı yok', () => {
    const ctrl = readFileSync(join(here, 'claim-files.controller.ts'), 'utf8');
    assert.match(ctrl, /:id\/field-close/);
    assert.match(ctrl, /closeAfterFieldInspection/);
    assert.match(ctrl, /ofis dosyasını kapatmaz/);
  });
});
