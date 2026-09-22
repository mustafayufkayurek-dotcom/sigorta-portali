/**
 * Gün sonu mail + ay sonu mali müşavir + çan yolu.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/modules/hr/hr-attendance-reminder.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  isIstanbulLastCalendarDay,
  roleReceivesAttendanceReminders,
} from './hr-attendance-reminder.helper.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('puantaj hatırlatma LOCK', () => {
  it('mail giden hesap kendi gününü Devam’dan onaylar', () => {
    const guard = readFileSync(
      join(here, '../../common/guards/permissions.guard.ts'),
      'utf8',
    );
    const office = guard.slice(guard.indexOf('OFFICE_STAFF:'), guard.indexOf('FIELD_STAFF:'));
    const finans = guard.slice(guard.indexOf('FINANS:'), guard.indexOf('ACCOUNTANT:'));
    const accountant = guard.slice(guard.indexOf('ACCOUNTANT:'), guard.indexOf('MANAGER:'));
    const manager = guard.slice(guard.indexOf('MANAGER:'), guard.indexOf('ADJUSTER:'));
    for (const block of [office, finans, accountant, manager]) {
      assert.match(block, /hr\.view/);
    }
    assert.match(office, /hr\.leave\.request/);
    assert.doesNotMatch(office, /hr\.supervise/);
    const controller = readFileSync(join(here, 'hr.controller.ts'), 'utf8');
    const confirm = controller.slice(
      controller.indexOf("@Post('attendance/confirm-day')"),
      controller.indexOf("@Post('attendance/confirm-month')"),
    );
    assert.match(confirm, /hr\.view/);
  });

  it('admin ve saha günlük puantaj maili almaz', () => {
    assert.equal(roleReceivesAttendanceReminders('admin'), false);
    assert.equal(roleReceivesAttendanceReminders('field_staff'), false);
    assert.equal(roleReceivesAttendanceReminders('office_staff'), true);
    assert.equal(roleReceivesAttendanceReminders('finance'), true);
  });

  it('30 Eylül son gün, 18 Eylül değil', () => {
    assert.equal(isIstanbulLastCalendarDay(new Date('2026-09-30T12:00:00.000Z')), true);
    assert.equal(isIstanbulLastCalendarDay(new Date('2026-09-18T12:00:00.000Z')), false);
  });

  it('zamanlayıcı gün sonu ve mali müşavir cron durur', () => {
    const src = readFileSync(join(here, 'hr-attendance-reminder.scheduler.ts'), 'utf8');
    assert.match(src, /hr-attendance-day-end-weekday/);
    assert.match(src, /hr-attendance-day-end-saturday/);
    assert.match(src, /hr-attendance-accountant-month-end/);
    assert.match(src, /processDayEndReminders/);
    assert.match(src, /processMonthEndAccountantSend/);
    const svc = readFileSync(join(here, 'hr-attendance-reminder.service.ts'), 'utf8');
    assert.match(svc, /async processDayEndReminders/);
    assert.match(svc, /async processMonthEndAccountantSend/);
    const hours = readFileSync(join(here, 'hr-work-hours.helper.ts'), 'utf8');
    assert.match(hours, /export function shouldRunDayEndAttendanceReminder/);
  });
});
