import {
  evaluateClockCompliance,
  evaluateEarlyExitNotice,
  evaluatePanelAccess,
  expectedWorkWindow,
  getWorkHoursSchedule,
  istanbulMinutesOfDay,
  isWithinStaffNotifyWindow,
} from './hr-work-hours.helper';

describe('hr-work-hours.helper', () => {
  it('hafta içi ve cumartesi penceresi döner', () => {
    expect(expectedWorkWindow('2026-08-03')).toEqual({ start: '08:30', end: '18:00' }); // Pazartesi
    expect(expectedWorkWindow('2026-08-08')).toEqual({ start: '08:30', end: '13:00' }); // Cumartesi
    expect(expectedWorkWindow('2026-08-09')).toBeNull(); // Pazar
    expect(expectedWorkWindow('2026-08-30')).toBeNull(); // Zafer Bayramı
  });

  it('geç başlangıç ve erken çıkışı hesaplar', () => {
    // 2026-08-03 Pazartesi — İstanbul 09:00 giriş, 17:00 çıkış
    const clockIn = '2026-08-03T06:00:00.000Z'; // 09:00 TR
    const clockOut = '2026-08-03T14:00:00.000Z'; // 17:00 TR
    const r = evaluateClockCompliance('2026-08-03', clockIn, clockOut);
    expect(r.isLateStart).toBe(true);
    expect(r.lateStartMinutes).toBe(25); // 09:00 - 08:30 = 30, grace 5 → 25
    expect(r.isEarlyLeave).toBe(true);
    expect(r.earlyLeaveMinutes).toBe(55); // 18:00 - 17:00 = 60, grace 5 → 55
  });

  it('tolerans içinde ihlal saymaz', () => {
    const clockIn = '2026-08-03T05:33:00.000Z'; // 08:33 TR (+3 dk)
    const clockOut = '2026-08-03T14:57:00.000Z'; // 17:57 TR (-3 dk)
    const r = evaluateClockCompliance('2026-08-03', clockIn, clockOut);
    expect(r.isLateStart).toBe(false);
    expect(r.isEarlyLeave).toBe(false);
  });

  it('tatilde compliance atlar', () => {
    const r = evaluateClockCompliance(
      '2026-08-30',
      '2026-08-30T06:00:00.000Z',
      '2026-08-30T14:00:00.000Z',
    );
    expect(r.isWorkDay).toBe(false);
    expect(r.isLateStart).toBe(false);
  });

  it('istanbul dakika dönüşümü', () => {
    expect(istanbulMinutesOfDay('2026-08-03T05:30:00.000Z')).toBe(8 * 60 + 30);
  });

  it('schedule özeti tutarlı', () => {
    const s = getWorkHoursSchedule();
    expect(s.labels.summary).toContain('08:30–18:00');
    expect(s.labels.summary).toContain('08:30–13:00');
  });

  it('hafta içi geç girişte masum bildirim, giriş açık', () => {
    // 2026-08-03 Pazartesi 09:20 TR = 06:20 UTC
    const r = evaluatePanelAccess(new Date('2026-08-03T06:20:00.000Z'));
    expect(r.canEnter).toBe(true);
    expect(r.notice).toBe('late_entry');
    expect(r.clockLabel).toBe('09:20');
  });

  it('Cumartesi 13:01 sonrası giriş kapalı', () => {
    // 2026-08-08 Cumartesi 13:01 TR = 10:01 UTC
    const r = evaluatePanelAccess(new Date('2026-08-08T10:01:00.000Z'));
    expect(r.canEnter).toBe(false);
    expect(r.notice).toBe('closed');
    expect(r.closedReasonLabel).toMatch(/13:00/);
  });

  it('Pazar giriş kapalı', () => {
    const r = evaluatePanelAccess(new Date('2026-08-09T08:00:00.000Z'));
    expect(r.canEnter).toBe(false);
    expect(r.closedReasonLabel).toMatch(/Pazar/);
  });

  it('resmi tatilde giriş kapalı (Zafer Bayramı)', () => {
    const r = evaluatePanelAccess(new Date('2026-08-30T07:00:00.000Z'));
    expect(r.canEnter).toBe(false);
    expect(r.closedReasonLabel).toMatch(/Zafer Bayramı/);
  });

  it('mesai bitmeden çıkış bildirimi', () => {
    const r = evaluateEarlyExitNotice(new Date('2026-08-03T14:00:00.000Z')); // 17:00 TR
    expect(r.show).toBe(true);
    expect(r.clockLabel).toBe('17:00');
  });

  it('personel uyarı penceresi — mesai içi açık, dışı kapalı', () => {
    // Pazartesi 09:00 TR
    expect(isWithinStaffNotifyWindow(new Date('2026-08-03T06:00:00.000Z'))).toBe(true);
    // Pazartesi 07:00 TR (mesai öncesi)
    expect(isWithinStaffNotifyWindow(new Date('2026-08-03T04:00:00.000Z'))).toBe(false);
    // Pazartesi 19:00 TR (mesai sonrası)
    expect(isWithinStaffNotifyWindow(new Date('2026-08-03T16:00:00.000Z'))).toBe(false);
    // Pazar
    expect(isWithinStaffNotifyWindow(new Date('2026-08-09T08:00:00.000Z'))).toBe(false);
    // Cumartesi 12:00 TR açık, 14:00 TR kapalı
    expect(isWithinStaffNotifyWindow(new Date('2026-08-08T09:00:00.000Z'))).toBe(true);
    expect(isWithinStaffNotifyWindow(new Date('2026-08-08T11:00:00.000Z'))).toBe(false);
  });
});
