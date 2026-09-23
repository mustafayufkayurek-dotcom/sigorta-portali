/**
 * Çalıştır: node --experimental-strip-types --test \
 *   packages/shared/src/acil-status-transition.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  ACIL_STATUS_SEQUENCE_MESSAGE,
  canAdvanceAcilStatus,
} from './acil-status-transition.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('acil durum basamak LOCK', () => {
  it('aynı durum ve canlı ileri adımlar geçer; atlama ve geri sıçrama durur', () => {
    assert.equal(canAdvanceAcilStatus('GELEN', 'GELEN'), true);
    assert.equal(canAdvanceAcilStatus('GELEN', 'ATANDI'), true);
    assert.equal(canAdvanceAcilStatus('GELEN', 'SAHADA'), true);
    assert.equal(canAdvanceAcilStatus('ATANDI', 'SAHADA'), true);
    assert.equal(canAdvanceAcilStatus('ATANDI', 'COZULDU'), true);
    assert.equal(canAdvanceAcilStatus('SAHADA', 'COZULDU'), true);
    assert.equal(canAdvanceAcilStatus('COZULDU', 'FATURALANDILDI'), true);

    assert.equal(canAdvanceAcilStatus('GELEN', 'COZULDU'), false);
    assert.equal(canAdvanceAcilStatus('GELEN', 'FATURALANDILDI'), false);
    assert.equal(canAdvanceAcilStatus('ATANDI', 'FATURALANDILDI'), false);
    assert.equal(canAdvanceAcilStatus('SAHADA', 'FATURALANDILDI'), false);
    assert.equal(canAdvanceAcilStatus('SAHADA', 'GELEN'), false);
    assert.equal(canAdvanceAcilStatus('COZULDU', 'SAHADA'), false);
    assert.equal(canAdvanceAcilStatus('FATURALANDILDI', 'COZULDU'), false);
    assert.equal(canAdvanceAcilStatus('FATURALANDILDI', 'GELEN'), false);
  });

  it('uyarı cümlesi kilitlidir; PATCH kapısı kuralı kullanır', () => {
    assert.equal(ACIL_STATUS_SEQUENCE_MESSAGE, 'Bu işlem sırasıyla yapılmalıdır');
    const svc = readFileSync(
      join(here, '../../../apps/backend/src/modules/emergency/emergency-cases.service.ts'),
      'utf8',
    );
    assert.match(svc, /canAdvanceAcilStatus/);
    assert.match(svc, /ACIL_STATUS_SEQUENCE_MESSAGE/);
    assert.match(svc, /BadRequestException\(ACIL_STATUS_SEQUENCE_MESSAGE\)/);
    const page = readFileSync(
      join(here, '../../../apps/web/src/app/panel/acil-yardim/[id]/page.tsx'),
      'utf8',
    );
    assert.match(page, /ACIL_STATUS_SEQUENCE_MESSAGE/);
    assert.match(page, /getApiErrorMessage/);
  });
});
