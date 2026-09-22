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
  isCustomerOrVendorRole,
  isIstanbulLastCalendarDay,
  roleCanBeAddedAsPersonnel,
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
    const field = guard.slice(guard.indexOf('FIELD_STAFF:'), guard.indexOf('FINANS:'));
    const finans = guard.slice(guard.indexOf('FINANS:'), guard.indexOf('ACCOUNTANT:'));
    const accountant = guard.slice(guard.indexOf('ACCOUNTANT:'), guard.indexOf('MANAGER:'));
    const manager = guard.slice(guard.indexOf('MANAGER:'), guard.indexOf('ADJUSTER:'));
    for (const block of [office, field, finans, accountant, manager]) {
      assert.match(block, /hr\.view/);
    }
    assert.match(office, /hr\.leave\.request/);
    assert.match(field, /hr\.leave\.request/);
    assert.doesNotMatch(office, /hr\.supervise/);
    assert.doesNotMatch(field, /hr\.supervise/);
    const controller = readFileSync(join(here, 'hr.controller.ts'), 'utf8');
    const confirm = controller.slice(
      controller.indexOf("@Post('attendance/confirm-day')"),
      controller.indexOf("@Post('attendance/confirm-month')"),
    );
    assert.match(confirm, /hr\.view/);
  });

  it('saha kadroya girince mail alır; müşteri ve tedarikçi almaz', () => {
    assert.equal(roleReceivesAttendanceReminders('admin'), false);
    assert.equal(roleReceivesAttendanceReminders('field_staff'), true);
    assert.equal(roleReceivesAttendanceReminders('office_staff'), true);
    assert.equal(roleReceivesAttendanceReminders('finance'), true);
    assert.equal(roleReceivesAttendanceReminders('expert'), false);
    assert.equal(roleReceivesAttendanceReminders('insurance_company_user'), false);
    assert.equal(roleReceivesAttendanceReminders('broker_user'), false);
    assert.equal(roleReceivesAttendanceReminders('vendor'), false);
    assert.equal(roleReceivesAttendanceReminders(''), false);
    assert.equal(isCustomerOrVendorRole('expert'), true);
    assert.equal(isCustomerOrVendorRole('field_staff'), false);
    assert.equal(roleCanBeAddedAsPersonnel('field_staff'), true);
    assert.equal(roleCanBeAddedAsPersonnel('expert'), false);
    assert.equal(roleCanBeAddedAsPersonnel('broker_user'), false);
    const service = readFileSync(join(here, 'hr.service.ts'), 'utf8');
    assert.match(service, /Müşteri ve tedarikçi personel kadrosuna alınamaz/);
    assert.match(service, /portalCustomerId/);
    assert.match(service, /Personel kaydı yok/);
    const layout = readFileSync(
      join(here, '../../../../web/src/app/panel/layout.tsx'),
      'utf8',
    );
    const fieldMenu = layout.slice(layout.indexOf("title: 'Saha Merkezi'"), layout.indexOf(': isFinance'));
    assert.match(fieldMenu, /\/panel\/personel-ozluk/);
    const gate = layout.slice(layout.indexOf('<AttendancePanelGate'), layout.indexOf('<PanelActivityHeartbeat'));
    assert.doesNotMatch(gate, /isFieldStaff/);
    const nav = layout.slice(
      layout.indexOf("path: '/panel/personel-ozluk'"),
      layout.indexOf("path: '/panel/personel-yonetimi'"),
    );
    assert.match(nav, /field_staff/);
    const routes = readFileSync(
      join(here, '../../../../web/src/utils/panel-route-access.rules.json'),
      'utf8',
    );
    const personelRoute = routes.slice(
      routes.indexOf('"/panel/personel-ozluk"'),
      routes.indexOf('"/panel/musteriler"'),
    );
    assert.match(personelRoute, /field_staff/);
    assert.doesNotMatch(personelRoute, /expert/);
    assert.doesNotMatch(personelRoute, /broker_user/);
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
