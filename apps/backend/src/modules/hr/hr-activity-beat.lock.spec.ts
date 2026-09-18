/**
 * Puantaj işlem / mesai nabzı düşer. Writer silinirse kilit kırılır.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/modules/hr/hr-activity-beat.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ACTIVITY_BEAT_IDLE_GAP_MS, applyActivityBeat } from './hr-activity-beat.helper.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('puantaj activity beat LOCK', () => {
  it('ilk nabız süre yazmaz; yakın nabız aktif, uzun boşluk boşta sayılır', () => {
    const t0 = new Date('2026-09-18T05:30:00.000Z');
    const first = applyActivityBeat(null, t0);
    assert.equal(first.activeMs, 0);
    assert.equal(first.beatCount, 1);

    const t1 = new Date(t0.getTime() + 60_000);
    const second = applyActivityBeat(first, t1);
    assert.equal(second.activeMs, 60_000);
    assert.equal(second.idleMs, 0);
    assert.equal(second.startedAt.toISOString(), t0.toISOString());

    const t2 = new Date(t1.getTime() + ACTIVITY_BEAT_IDLE_GAP_MS + 1);
    const third = applyActivityBeat(second, t2);
    assert.equal(third.activeMs, 60_000);
    assert.ok(third.idleMs > 0);
    assert.equal(third.lastBeatAt.toISOString(), t2.toISOString());
  });

  it('servis nabzı activity_sessions tablosuna yazar', () => {
    const src = readFileSync(join(here, 'hr.service.ts'), 'utf8');
    assert.match(src, /async recordActivityBeat/);
    assert.match(src, /activitySession\.upsert/);
    assert.match(src, /applyActivityBeat/);
    const controller = readFileSync(join(here, 'hr.controller.ts'), 'utf8');
    assert.match(controller, /Post\('activity\/beat'\)/);
    assert.match(controller, /recordActivityBeat/);
  });

  it('günlük onay tarihi iş gününden okunur (onay anının UTC kesmesi değil)', () => {
    const src = readFileSync(join(here, 'hr.service.ts'), 'utf8');
    const slice = src.slice(
      src.indexOf('async buildDayEndRoster'),
      src.indexOf('async getMissingAttendanceRecipients'),
    );
    assert.match(slice, /lastConfirmedDate = this\.dateKeyFromUtcDate\(entry\.workDate\)/);
    assert.doesNotMatch(slice, /dateKeyFromUtcDate\(entry\.employeeConfirmedAt\)/);
  });
});
