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
  it('field-close açık dosyayı closed yapmaz; tespiti sonlandırır', () => {
    const src = readFileSync(join(here, 'claim-files.service.ts'), 'utf8');
    const start = src.indexOf('async closeAfterFieldInspection');
    const end = src.indexOf('async submitCostReport');
    assert.ok(start >= 0 && end > start);
    const fn = src.slice(start, end);
    assert.match(fn, /addInspectionNote/);
    assert.match(fn, /INSPECTION_DONE/);
    assert.doesNotMatch(fn, /closedAt/);
    assert.doesNotMatch(fn, /isClosedState:\s*true/);
    assert.doesNotMatch(fn, /ensureCampaignForClaimFile/);
    assert.doesNotMatch(fn, /code:\s*'closed'/);
    assert.doesNotMatch(fn, /BadRequestException/);
  });

  it('kapı durur; tespiti sonlandırır, ofis kapanışı yok', () => {
    const ctrl = readFileSync(join(here, 'claim-files.controller.ts'), 'utf8');
    assert.match(ctrl, /:id\/field-close/);
    assert.match(ctrl, /closeAfterFieldInspection/);
    assert.match(ctrl, /ofis dosyasını kapatmaz/);
    assert.match(ctrl, /tespiti sonlandırır/);
  });

  it('eski saha kapatması ofis dosyasını kapalı bırakmaz; from_status açılır', () => {
    const sql = readFileSync(
      join(here, '../../../../../scripts/repair-saha-field-close-reopen.sql'),
      'utf8',
    );
    assert.match(sql, /Saha tespiti sonrası dosya kapatıldı/);
    assert.match(sql, /closed_at = NULL/);
    assert.match(sql, /from_status_id/);
    assert.match(sql, /status = 'expired'/);
    assert.match(sql, /tespit tamam, dosya açık/);
  });
});
