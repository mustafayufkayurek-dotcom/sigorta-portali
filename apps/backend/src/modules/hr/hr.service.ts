import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import {
  HR_ATTENDANCE_ENTRY_TYPE,
  HR_ATTENDANCE_STATUS,
  HR_LEAVE_STATUS,
  HR_LEAVE_TYPE,
  HR_LEAVE_TYPE_LABELS,
  HR_ATTENDANCE_STATUS_LABELS,
} from './hr.constants';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { UpsertAttendanceDto } from './dto/upsert-attendance.dto';
import { ConfirmAttendanceDayDto, ConfirmAttendanceMonthDto } from './dto/confirm-attendance.dto';
import {
  getPublicHolidayName,
  isPublicHoliday,
  isWeeklyRestDay,
  parseDateKey,
} from './hr-turkey-calendar.helper';

type AuthUser = {
  id?: string;
  userId?: string;
  roleCode?: string | null;
  permissions?: string[];
};

@Injectable()
export class HrService {
  constructor(private readonly prisma: PrismaService) {}

  private toDateOnly(value: string | Date): Date {
    if (value instanceof Date) {
      return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
    }
    const [y, m, d] = value.slice(0, 10).split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }

  private countCalendarDays(start: Date, end: Date): number {
    const diff = end.getTime() - start.getTime();
    if (diff < 0) return 0;
    return Math.floor(diff / 86_400_000) + 1;
  }

  private monthRange(year: number, month: number) {
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 0));
    return { start, end };
  }

  /** Takvim günü anahtarı — DB date-only alanlarıyla uyumlu YYYY-MM-DD. */
  private dateKeyFromUtcDate(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  private todayKeyInIstanbul(): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());
  }

  private daysInMonth(year: number, month: number): number {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
  }

  private canApprove(user: AuthUser): boolean {
    const role = user.roleCode?.toUpperCase();
    if (role === 'ADMIN') return true;
    return (user.permissions ?? []).includes('hr.leave.approve');
  }

  /** Türkçe ad-soyad karşılaştırması (AgreementConsentModal ile uyumlu). */
  private normalizePersonName(value: string): string {
    return value
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/İ/g, 'i')
      .replace(/I/g, 'ı')
      .replace(/Ğ/g, 'ğ')
      .replace(/Ü/g, 'ü')
      .replace(/Ş/g, 'ş')
      .replace(/Ö/g, 'ö')
      .replace(/Ç/g, 'ç');
  }

  private async assertSignatureMatchesUser(userId: string, signature: string): Promise<string> {
    const trimmed = signature.trim().replace(/\s+/g, ' ');
    if (!trimmed) {
      throw new BadRequestException('Dijital imza (ad-soyad) zorunludur');
    }
    const dbUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });
    if (!dbUser) {
      throw new BadRequestException('Kullanıcı bulunamadı');
    }
    const expected = `${dbUser.firstName ?? ''} ${dbUser.lastName ?? ''}`.trim();
    if (!expected) {
      throw new BadRequestException('Hesabınızda ad-soyad tanımlı değil; profilinizi güncelleyin');
    }
    if (this.normalizePersonName(trimmed) !== this.normalizePersonName(expected)) {
      throw new BadRequestException(
        `Girilen imza (${trimmed}) hesabınızdaki ad-soyad (${expected}) ile uyuşmuyor`,
      );
    }
    return trimmed;
  }

  /** JwtAuthGuard `id` döner; eski kod yolları `userId` kullanabilir. */
  private authUserId(user: AuthUser): string {
    const id = user.id ?? user.userId;
    if (!id) {
      throw new BadRequestException('Kullanıcı kimliği bulunamadı');
    }
    return id;
  }

  private parseOptionalDateTime(value?: string | null): Date | undefined {
    if (!value?.trim()) return undefined;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException('Geçersiz tarih/saat formatı');
    }
    return d;
  }

  private clockTimesFromActivity(activity: { startedAt: Date; lastBeatAt: Date } | null) {
    if (!activity) return { clockInAt: null as Date | null, clockOutAt: null as Date | null };
    return { clockInAt: activity.startedAt, clockOutAt: activity.lastBeatAt };
  }

  private resolveClockTimes(
    entry: { clockInAt: Date | null; clockOutAt: Date | null } | undefined,
    activity: { startedAt: Date; lastBeatAt: Date } | null,
  ) {
    const suggested = this.clockTimesFromActivity(activity);
    const recordedIn = entry?.clockInAt ?? null;
    const recordedOut = entry?.clockOutAt ?? null;
    return {
      clockInAt: (recordedIn ?? suggested.clockInAt)?.toISOString() ?? null,
      clockOutAt: (recordedOut ?? suggested.clockOutAt)?.toISOString() ?? null,
      recordedClockInAt: recordedIn?.toISOString() ?? null,
      recordedClockOutAt: recordedOut?.toISOString() ?? null,
      suggestedClockInAt: suggested.clockInAt?.toISOString() ?? null,
      suggestedClockOutAt: suggested.clockOutAt?.toISOString() ?? null,
    };
  }

  async ensureEmployeeProfile(userId: string) {
    const existing = await this.prisma.hrEmployeeProfile.findUnique({
      where: { userId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        department: { select: { id: true, name: true } },
        manager: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (existing) return existing;

    return this.prisma.hrEmployeeProfile.create({
      data: { userId, status: 'active' },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        department: { select: { id: true, name: true } },
        manager: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  private async ensureAnnualBalance(employeeProfileId: string, year: number) {
    return this.prisma.hrLeaveBalance.upsert({
      where: {
        employeeProfileId_leaveType_year: {
          employeeProfileId,
          leaveType: HR_LEAVE_TYPE.ANNUAL,
          year,
        },
      },
      update: {},
      create: {
        employeeProfileId,
        leaveType: HR_LEAVE_TYPE.ANNUAL,
        year,
        totalDays: 14,
        usedDays: 0,
        pendingDays: 0,
      },
    });
  }

  async getSummary(user: AuthUser) {
    const profile = await this.ensureEmployeeProfile(this.authUserId(user));
    const year = new Date().getFullYear();
    const balance = await this.ensureAnnualBalance(profile.id, year);

    const [pendingMine, approvedThisYear, attendanceThisMonth] = await Promise.all([
      this.prisma.hrLeaveRequest.count({
        where: { employeeProfileId: profile.id, status: HR_LEAVE_STATUS.PENDING },
      }),
      this.prisma.hrLeaveRequest.count({
        where: {
          employeeProfileId: profile.id,
          status: HR_LEAVE_STATUS.APPROVED,
          startDate: { gte: new Date(Date.UTC(year, 0, 1)) },
        },
      }),
      this.prisma.hrAttendanceEntry.count({
        where: {
          employeeProfileId: profile.id,
          workDate: {
            gte: new Date(Date.UTC(year, new Date().getMonth(), 1)),
            lte: new Date(Date.UTC(year, new Date().getMonth() + 1, 0)),
          },
        },
      }),
    ]);

    let pendingApprovalCount = 0;
    if (this.canApprove(user)) {
      pendingApprovalCount = await this.prisma.hrLeaveRequest.count({
        where: { status: HR_LEAVE_STATUS.PENDING },
      });
    }

    return {
      profile: {
        id: profile.id,
        personnelNo: profile.personnelNo,
        hireDate: profile.hireDate,
        department: profile.department,
        manager: profile.manager,
        user: profile.user,
      },
      leaveBalance: {
        leaveType: balance.leaveType,
        leaveTypeLabel: HR_LEAVE_TYPE_LABELS[HR_LEAVE_TYPE.ANNUAL],
        year: balance.year,
        totalDays: Number(balance.totalDays),
        usedDays: Number(balance.usedDays),
        pendingDays: Number(balance.pendingDays),
        remainingDays: Number(balance.totalDays) - Number(balance.usedDays) - Number(balance.pendingDays),
      },
      stats: {
        pendingLeaveRequests: pendingMine,
        approvedLeavesThisYear: approvedThisYear,
        attendanceRecordsThisMonth: attendanceThisMonth,
        pendingApprovalQueue: pendingApprovalCount,
      },
      canApprove: this.canApprove(user),
    };
  }

  private async getPeriodLock(employeeProfileId: string, year: number, month: number) {
    return this.prisma.hrAttendancePeriodLock.findUnique({
      where: {
        employeeProfileId_year_month: { employeeProfileId, year, month },
      },
    });
  }

  private assertPeriodNotLocked(lockedAt: Date | null | undefined) {
    if (lockedAt) {
      throw new BadRequestException('Bu ay puantajı kilitlenmiş; değişiklik yapılamaz');
    }
  }

  private isDateOnApprovedLeave(
    dateKey: string,
    leaves: Array<{ startDate: Date; endDate: Date }>,
  ): boolean {
    const t = parseDateKey(dateKey).getTime();
    return leaves.some((l) => {
      const start = l.startDate.getTime();
      const end = l.endDate.getTime();
      return t >= start && t <= end;
    });
  }

  private resolveAutoStatus(
    dateKey: string,
    approvedLeaves: Array<{ startDate: Date; endDate: Date }>,
  ): { status: string; label: string | null } | null {
    if (isPublicHoliday(dateKey)) {
      return { status: HR_ATTENDANCE_STATUS.HOLIDAY, label: getPublicHolidayName(dateKey) };
    }
    if (isWeeklyRestDay(dateKey)) {
      return { status: HR_ATTENDANCE_STATUS.WEEKLY_REST, label: 'Hafta Tatili' };
    }
    if (this.isDateOnApprovedLeave(dateKey, approvedLeaves)) {
      return { status: HR_ATTENDANCE_STATUS.LEAVE, label: 'Onaylı İzin' };
    }
    return null;
  }

  async listAttendance(user: AuthUser, year: number, month: number) {
    const profile = await this.ensureEmployeeProfile(this.authUserId(user));
    const { start, end } = this.monthRange(year, month);

    const [entries, activitySessions, approvedLeaves, periodLock] = await Promise.all([
      this.prisma.hrAttendanceEntry.findMany({
        where: {
          employeeProfileId: profile.id,
          workDate: { gte: start, lte: end },
        },
        orderBy: { workDate: 'asc' },
      }),
      this.prisma.activitySession.findMany({
        where: {
          userId: this.authUserId(user),
          sessionDate: { gte: start, lte: end },
        },
        orderBy: { sessionDate: 'asc' },
      }),
      this.prisma.hrLeaveRequest.findMany({
        where: {
          employeeProfileId: profile.id,
          status: HR_LEAVE_STATUS.APPROVED,
          startDate: { lte: end },
          endDate: { gte: start },
        },
        select: { startDate: true, endDate: true },
      }),
      this.getPeriodLock(profile.id, year, month),
    ]);

    const activityByDate = new Map(
      activitySessions.map((s) => [
        this.dateKeyFromUtcDate(s.sessionDate),
        {
          activeMinutes: Math.round(s.activeMs / 60_000),
          startedAt: s.startedAt,
          lastBeatAt: s.lastBeatAt,
        },
      ]),
    );

    const entryByDate = new Map(
      entries.map((e) => [this.dateKeyFromUtcDate(e.workDate), e]),
    );

    const days: Array<{
      date: string;
      dayOfMonth: number;
      weekday: number;
      attendanceStatus: string | null;
      statusLabel: string | null;
      minutesWorked: number | null;
      suggestedMinutes: number | null;
      clockInAt: string | null;
      clockOutAt: string | null;
      suggestedClockInAt: string | null;
      suggestedClockOutAt: string | null;
      source: string | null;
      entryId: string | null;
      hasManualEntry: boolean;
      employeeConfirmedAt: string | null;
      isFuture: boolean;
      isAutoMarked: boolean;
    }> = [];

    const todayKey = this.todayKeyInIstanbul();
    const totalDays = this.daysInMonth(year, month);
    const isLocked = Boolean(periodLock?.lockedAt);

    for (let day = 1; day <= totalDays; day += 1) {
      const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isFuture = key > todayKey;
      const entry = entryByDate.get(key);
      const activity = activityByDate.get(key);
      const suggested = activity?.activeMinutes ?? null;
      const auto = entry?.source === 'manual' ? null : this.resolveAutoStatus(key, approvedLeaves);
      const clocks = this.resolveClockTimes(entry, activity ?? null);

      let attendanceStatus = entry?.attendanceStatus ?? auto?.status ?? null;
      let statusLabel: string | null = null;
      if (entry?.attendanceStatus) {
        statusLabel = HR_ATTENDANCE_STATUS_LABELS[entry.attendanceStatus as keyof typeof HR_ATTENDANCE_STATUS_LABELS] ?? null;
      } else if (auto) {
        statusLabel = auto.label;
      }

      days.push({
        date: key,
        dayOfMonth: day,
        weekday: parseDateKey(key).getUTCDay(),
        attendanceStatus,
        statusLabel,
        minutesWorked: entry?.minutesWorked ?? null,
        suggestedMinutes: entry?.suggestedMinutes ?? suggested,
        clockInAt: clocks.clockInAt,
        clockOutAt: clocks.clockOutAt,
        suggestedClockInAt: clocks.suggestedClockInAt,
        suggestedClockOutAt: clocks.suggestedClockOutAt,
        source: entry?.source ?? (suggested != null ? 'activity' : auto ? 'calendar' : null),
        entryId: entry?.id ?? null,
        hasManualEntry: Boolean(entry && entry.source === 'manual'),
        employeeConfirmedAt: entry?.employeeConfirmedAt?.toISOString() ?? null,
        isFuture,
        isAutoMarked: Boolean(!entry && auto),
      });
    }

    const needsDailyConfirm = (d: (typeof days)[0]) =>
      !d.isFuture
      && d.attendanceStatus !== HR_ATTENDANCE_STATUS.WEEKLY_REST
      && d.attendanceStatus !== HR_ATTENDANCE_STATUS.HOLIDAY
      && d.attendanceStatus !== HR_ATTENDANCE_STATUS.LEAVE;

    const confirmedDays = days.filter((d) => d.employeeConfirmedAt && needsDailyConfirm(d)).length;
    const pastWorkDays = days.filter(needsDailyConfirm).length;
    const pendingConfirmationDays = days.filter((d) => needsDailyConfirm(d) && !d.employeeConfirmedAt).length;

    return {
      year,
      month,
      days,
      entries,
      periodLock: periodLock
        ? {
            employeeConfirmedAt: periodLock.employeeConfirmedAt?.toISOString() ?? null,
            employeeSignature: periodLock.employeeSignature ?? null,
            employeeSignatureAt: periodLock.employeeSignatureAt?.toISOString() ?? null,
            managerConfirmedAt: periodLock.managerConfirmedAt?.toISOString() ?? null,
            managerSignature: periodLock.managerSignature ?? null,
            managerSignatureAt: periodLock.managerSignatureAt?.toISOString() ?? null,
            lockedAt: periodLock.lockedAt?.toISOString() ?? null,
            isLocked,
          }
        : {
            employeeConfirmedAt: null,
            employeeSignature: null,
            employeeSignatureAt: null,
            managerConfirmedAt: null,
            managerSignature: null,
            managerSignatureAt: null,
            lockedAt: null,
            isLocked: false,
          },
      summary: {
        confirmedDays,
        pastWorkDays,
        pendingConfirmationDays,
      },
    };
  }

  /** Personel günlük puantaj onayı — "bugün çalıştım" dijital teyit */
  async confirmAttendanceDay(user: AuthUser, dto: ConfirmAttendanceDayDto) {
    const profile = await this.ensureEmployeeProfile(this.authUserId(user));
    const workDate = this.toDateOnly(dto.workDate);
    const dateKey = this.dateKeyFromUtcDate(workDate);
    const todayKey = this.todayKeyInIstanbul();

    if (dateKey > todayKey) {
      throw new BadRequestException('Gelecek günler için onay verilemez');
    }

    const year = workDate.getUTCFullYear();
    const month = workDate.getUTCMonth() + 1;
    const periodLock = await this.getPeriodLock(profile.id, year, month);
    this.assertPeriodNotLocked(periodLock?.lockedAt);

    const activity = await this.prisma.activitySession.findUnique({
      where: { userId_sessionDate: { userId: this.authUserId(user), sessionDate: workDate } },
    });
    const suggestedMinutes = activity ? Math.round(activity.activeMs / 60_000) : null;

    const approvedLeaves = await this.prisma.hrLeaveRequest.findMany({
      where: {
        employeeProfileId: profile.id,
        status: HR_LEAVE_STATUS.APPROVED,
        startDate: { lte: workDate },
        endDate: { gte: workDate },
      },
      select: { startDate: true, endDate: true },
    });
    const auto = this.resolveAutoStatus(dateKey, approvedLeaves);
    const defaultStatus = auto?.status ?? HR_ATTENDANCE_STATUS.PRESENT;
    const activityClocks = this.clockTimesFromActivity(activity);
    const clockInAt = this.parseOptionalDateTime(dto.clockInAt) ?? activityClocks.clockInAt;
    const clockOutAt = this.parseOptionalDateTime(dto.clockOutAt) ?? activityClocks.clockOutAt;

    const entry = await this.prisma.hrAttendanceEntry.upsert({
      where: {
        employeeProfileId_workDate_entryType: {
          employeeProfileId: profile.id,
          workDate,
          entryType: HR_ATTENDANCE_ENTRY_TYPE.REGULAR,
        },
      },
      update: {
        attendanceStatus: defaultStatus,
        minutesWorked: dto.minutesWorked ?? suggestedMinutes,
        suggestedMinutes,
        clockInAt,
        clockOutAt,
        notes: dto.notes,
        source: 'employee_confirm',
        employeeConfirmedAt: new Date(),
        employeeConfirmedByUserId: this.authUserId(user),
      },
      create: {
        employeeProfileId: profile.id,
        workDate,
        entryType: HR_ATTENDANCE_ENTRY_TYPE.REGULAR,
        attendanceStatus: defaultStatus,
        minutesWorked: dto.minutesWorked ?? suggestedMinutes,
        suggestedMinutes,
        clockInAt,
        clockOutAt,
        notes: dto.notes,
        source: 'employee_confirm',
        employeeConfirmedAt: new Date(),
        employeeConfirmedByUserId: this.authUserId(user),
        createdByUserId: this.authUserId(user),
      },
    });

    return entry;
  }

  /** Personel aylık puantaj onayı */
  async confirmAttendanceMonth(user: AuthUser, dto: ConfirmAttendanceMonthDto) {
    const profile = await this.ensureEmployeeProfile(this.authUserId(user));
    const periodLock = await this.getPeriodLock(profile.id, dto.year, dto.month);
    this.assertPeriodNotLocked(periodLock?.lockedAt);

    const attendance = await this.listAttendance(user, dto.year, dto.month);
    if (attendance.summary.pendingConfirmationDays > 0) {
      throw new BadRequestException(
        `Onaylanmamış ${attendance.summary.pendingConfirmationDays} iş günü var. Önce günlük onayları tamamlayın.`,
      );
    }

    const signature = await this.assertSignatureMatchesUser(this.authUserId(user), dto.signature);
    const signedAt = new Date();

    return this.prisma.hrAttendancePeriodLock.upsert({
      where: {
        employeeProfileId_year_month: {
          employeeProfileId: profile.id,
          year: dto.year,
          month: dto.month,
        },
      },
      update: {
        employeeConfirmedAt: signedAt,
        employeeSignature: signature,
        employeeSignatureAt: signedAt,
      },
      create: {
        employeeProfileId: profile.id,
        year: dto.year,
        month: dto.month,
        employeeConfirmedAt: signedAt,
        employeeSignature: signature,
        employeeSignatureAt: signedAt,
      },
    });
  }

  /** Yönetici ay kilidi — İK onayı */
  async lockAttendanceMonth(user: AuthUser, dto: ConfirmAttendanceMonthDto) {
    if (!this.canApprove(user)) {
      throw new ForbiddenException('Puantaj kilitleme yetkiniz yok');
    }

    const profile = await this.ensureEmployeeProfile(this.authUserId(user));
    const existing = await this.getPeriodLock(profile.id, dto.year, dto.month);

    if (!existing?.employeeConfirmedAt) {
      throw new BadRequestException('Personel aylık onayı tamamlanmadan kilitlenemez');
    }

    const signature = await this.assertSignatureMatchesUser(this.authUserId(user), dto.signature);
    const signedAt = new Date();

    return this.prisma.hrAttendancePeriodLock.upsert({
      where: {
        employeeProfileId_year_month: {
          employeeProfileId: profile.id,
          year: dto.year,
          month: dto.month,
        },
      },
      update: {
        managerConfirmedAt: signedAt,
        managerSignature: signature,
        managerSignatureAt: signedAt,
        lockedAt: signedAt,
        lockedByUserId: this.authUserId(user),
      },
      create: {
        employeeProfileId: profile.id,
        year: dto.year,
        month: dto.month,
        employeeConfirmedAt: existing.employeeConfirmedAt,
        employeeSignature: existing.employeeSignature,
        employeeSignatureAt: existing.employeeSignatureAt,
        managerConfirmedAt: signedAt,
        managerSignature: signature,
        managerSignatureAt: signedAt,
        lockedAt: signedAt,
        lockedByUserId: this.authUserId(user),
      },
    });
  }

  async upsertAttendance(user: AuthUser, dto: UpsertAttendanceDto) {
    const profile = await this.ensureEmployeeProfile(this.authUserId(user));
    const workDate = this.toDateOnly(dto.workDate);
    const periodLock = await this.getPeriodLock(
      profile.id,
      workDate.getUTCFullYear(),
      workDate.getUTCMonth() + 1,
    );
    this.assertPeriodNotLocked(periodLock?.lockedAt);

    const activity = await this.prisma.activitySession.findUnique({
      where: { userId_sessionDate: { userId: this.authUserId(user), sessionDate: workDate } },
    });
    const suggestedMinutes = activity ? Math.round(activity.activeMs / 60_000) : null;
    const activityClocks = this.clockTimesFromActivity(activity);
    const clockInAt = this.parseOptionalDateTime(dto.clockInAt) ?? activityClocks.clockInAt;
    const clockOutAt = this.parseOptionalDateTime(dto.clockOutAt) ?? activityClocks.clockOutAt;

    const entry = await this.prisma.hrAttendanceEntry.upsert({
      where: {
        employeeProfileId_workDate_entryType: {
          employeeProfileId: profile.id,
          workDate,
          entryType: HR_ATTENDANCE_ENTRY_TYPE.REGULAR,
        },
      },
      update: {
        attendanceStatus: dto.attendanceStatus ?? HR_ATTENDANCE_STATUS.PRESENT,
        minutesWorked: dto.minutesWorked ?? suggestedMinutes,
        suggestedMinutes,
        clockInAt,
        clockOutAt,
        notes: dto.notes,
        source: 'manual',
        createdByUserId: this.authUserId(user),
      },
      create: {
        employeeProfileId: profile.id,
        workDate,
        entryType: HR_ATTENDANCE_ENTRY_TYPE.REGULAR,
        attendanceStatus: dto.attendanceStatus ?? HR_ATTENDANCE_STATUS.PRESENT,
        minutesWorked: dto.minutesWorked ?? suggestedMinutes,
        suggestedMinutes,
        clockInAt,
        clockOutAt,
        notes: dto.notes,
        source: 'manual',
        createdByUserId: this.authUserId(user),
      },
    });

    return entry;
  }

  async listMyLeaveRequests(user: AuthUser) {
    const profile = await this.ensureEmployeeProfile(this.authUserId(user));
    return this.prisma.hrLeaveRequest.findMany({
      where: { employeeProfileId: profile.id },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async createLeaveRequest(user: AuthUser, dto: CreateLeaveRequestDto) {
    const profile = await this.ensureEmployeeProfile(this.authUserId(user));
    const startDate = this.toDateOnly(dto.startDate);
    const endDate = this.toDateOnly(dto.endDate);
    if (endDate < startDate) {
      throw new BadRequestException('Bitiş tarihi başlangıçtan önce olamaz');
    }

    const dayCount = this.countCalendarDays(startDate, endDate);
    const submit = dto.submit !== false;
    const status = submit ? HR_LEAVE_STATUS.PENDING : HR_LEAVE_STATUS.DRAFT;

    const request = await this.prisma.hrLeaveRequest.create({
      data: {
        employeeProfileId: profile.id,
        leaveType: dto.leaveType,
        startDate,
        endDate,
        dayCount,
        reason: dto.reason,
        status,
        submittedAt: submit ? new Date() : null,
      },
    });

    if (submit && dto.leaveType === HR_LEAVE_TYPE.ANNUAL) {
      const year = startDate.getUTCFullYear();
      const balance = await this.ensureAnnualBalance(profile.id, year);
      await this.prisma.hrLeaveBalance.update({
        where: { id: balance.id },
        data: { pendingDays: { increment: dayCount } },
      });
    }

    return request;
  }

  async submitLeaveRequest(user: AuthUser, id: string) {
    const profile = await this.ensureEmployeeProfile(this.authUserId(user));
    const request = await this.prisma.hrLeaveRequest.findFirst({
      where: { id, employeeProfileId: profile.id },
    });
    if (!request) throw new NotFoundException('İzin talebi bulunamadı');
    if (request.status !== HR_LEAVE_STATUS.DRAFT) {
      throw new BadRequestException('Yalnızca taslak talepler gönderilebilir');
    }

    const updated = await this.prisma.hrLeaveRequest.update({
      where: { id },
      data: {
        status: HR_LEAVE_STATUS.PENDING,
        submittedAt: new Date(),
      },
    });

    if (request.leaveType === HR_LEAVE_TYPE.ANNUAL && request.dayCount) {
      const balance = await this.ensureAnnualBalance(profile.id, request.startDate.getUTCFullYear());
      await this.prisma.hrLeaveBalance.update({
        where: { id: balance.id },
        data: { pendingDays: { increment: request.dayCount } },
      });
    }

    return updated;
  }

  async listPendingApprovals(user: AuthUser) {
    if (!this.canApprove(user)) {
      throw new ForbiddenException('İzin onay yetkiniz yok');
    }

    const requests = await this.prisma.hrLeaveRequest.findMany({
      where: { status: HR_LEAVE_STATUS.PENDING },
      include: {
        employeeProfile: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
            department: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ submittedAt: 'asc' }, { createdAt: 'asc' }],
    });

    return requests.map((r) => ({
      ...r,
      employeeName: `${r.employeeProfile.user.firstName ?? ''} ${r.employeeProfile.user.lastName ?? ''}`.trim(),
    }));
  }

  async approveLeaveRequest(user: AuthUser, id: string) {
    if (!this.canApprove(user)) {
      throw new ForbiddenException('İzin onay yetkiniz yok');
    }

    const request = await this.prisma.hrLeaveRequest.findUnique({
      where: { id },
      include: { employeeProfile: true },
    });
    if (!request) throw new NotFoundException('İzin talebi bulunamadı');
    if (request.status !== HR_LEAVE_STATUS.PENDING) {
      throw new BadRequestException('Yalnızca beklemedeki talepler onaylanabilir');
    }

    const updated = await this.prisma.hrLeaveRequest.update({
      where: { id },
      data: {
        status: HR_LEAVE_STATUS.APPROVED,
        approvedByUserId: this.authUserId(user),
        approvedAt: new Date(),
      },
    });

    if (request.leaveType === HR_LEAVE_TYPE.ANNUAL && request.dayCount) {
      const balance = await this.ensureAnnualBalance(
        request.employeeProfileId,
        request.startDate.getUTCFullYear(),
      );
      await this.prisma.hrLeaveBalance.update({
        where: { id: balance.id },
        data: {
          pendingDays: { decrement: request.dayCount },
          usedDays: { increment: request.dayCount },
        },
      });
    }

    return updated;
  }

  async rejectLeaveRequest(user: AuthUser, id: string, rejectionReason?: string) {
    if (!this.canApprove(user)) {
      throw new ForbiddenException('İzin onay yetkiniz yok');
    }

    const request = await this.prisma.hrLeaveRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('İzin talebi bulunamadı');
    if (request.status !== HR_LEAVE_STATUS.PENDING) {
      throw new BadRequestException('Yalnızca beklemedeki talepler reddedilebilir');
    }

    const updated = await this.prisma.hrLeaveRequest.update({
      where: { id },
      data: {
        status: HR_LEAVE_STATUS.REJECTED,
        rejectedByUserId: this.authUserId(user),
        rejectedAt: new Date(),
        rejectionReason,
      },
    });

    if (request.leaveType === HR_LEAVE_TYPE.ANNUAL && request.dayCount) {
      const balance = await this.ensureAnnualBalance(
        request.employeeProfileId,
        request.startDate.getUTCFullYear(),
      );
      await this.prisma.hrLeaveBalance.update({
        where: { id: balance.id },
        data: { pendingDays: { decrement: request.dayCount } },
      });
    }

    return updated;
  }

  async getLeaveBalances(user: AuthUser) {
    const profile = await this.ensureEmployeeProfile(this.authUserId(user));
    const year = new Date().getFullYear();
    const balance = await this.ensureAnnualBalance(profile.id, year);
    return [balance];
  }
}
