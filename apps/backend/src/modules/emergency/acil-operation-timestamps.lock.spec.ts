/**
 * Çalıştır: node --experimental-strip-types --test \
 *   apps/backend/src/modules/emergency/acil-operation-timestamps.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { nextAcilOperationStamps } from './acil-operation-timestamps.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('acil işlem saatleri LOCK', () => {
  it('işe başlama ve hizmet ilk yazımda kalır', () => {
    const t1 = new Date('2026-08-22T08:00:00.000Z');
    const t2 = new Date('2026-08-22T10:00:00.000Z');
    const start = nextAcilOperationStamps('EMERGENCY_WORK_START_READY', {}, t1);
    assert.equal(start.workStartedAt?.toISOString(), t1.toISOString());
    const again = nextAcilOperationStamps('EMERGENCY_WORK_START_READY', start, t2);
    assert.equal(Object.keys(again).length, 0);
    const done = nextAcilOperationStamps('EMERGENCY_SERVICE_COMPLETED', start, t2);
    assert.equal(done.serviceDeliveredAt?.toISOString(), t2.toISOString());
    assert.equal(done.workStartedAt, undefined);
  });

  it('hizmet işe başlamadan gelirse her iki saat de yazılır', () => {
    const now = new Date('2026-08-22T12:00:00.000Z');
    const stamps = nextAcilOperationStamps('EMERGENCY_SERVICE_COMPLETED', {}, now);
    assert.equal(stamps.workStartedAt?.toISOString(), now.toISOString());
    assert.equal(stamps.serviceDeliveredAt?.toISOString(), now.toISOString());
  });

  it('şema, süreç olayı ve PDF dört saati basar', () => {
    const schema = readFileSync(join(here, '../../../prisma/schema.prisma'), 'utf8');
    const svc = readFileSync(join(here, 'emergency-cases.service.ts'), 'utf8');
    const pdf = readFileSync(join(here, 'acil-closure-report-pdf.ts'), 'utf8');
    assert.match(schema, /workStartedAt/);
    assert.match(schema, /serviceDeliveredAt/);
    assert.match(svc, /nextAcilOperationStamps/);
    assert.match(svc, /operationTimestamps/);
    assert.match(pdf, /ihbarAt/);
    assert.match(pdf, /workStartedAt/);
    assert.match(pdf, /serviceDeliveredAt/);
    assert.match(pdf, /closedAt/);
  });
});
