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
import { annualLeaveEntitlementDays } from './hr-leave-entitlement.helper';
import { UpsertEmployeeProfileDto } from './dto/upsert-employee-profile.dto';
import { SystemSettingsService } from '@/modules/system-settings/system-settings.service';

type AuthUser = {
  id?: string;
  userId?: string;
  roleCode?: string | null;
  permissions?: string[];
};

@Injectable()
export class HrService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly systemSettings: SystemSettingsService,
  ) {}

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

  /** Kadro özeti + puantaj denetimi (admin / manager / finans) */
  private canSupervise(user: AuthUser): boolean {
    const role = user.roleCode?.toUpperCase();
    if (role === 'ADMIN' || role === 'MANAGER') return true;
    if (role === 'FINANCE' || role === 'ACCOUNTANT' || role === 'FINANS') return true;
    return (user.permissions ?? []).includes('hr.supervise');
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

  private async ensureAnnualBalance(
    employeeProfileId: string,
    year: number,
    hireDate?: Date | null,
  ) {
    const entitlement = annualLeaveEntitlementDays(hireDate ?? null);
    const existing = await this.prisma.hrLeaveBalance.findUnique({
      where: {
        employeeProfileId_leaveType_year: {
          employeeProfileId,
          leaveType: HR_LEAVE_TYPE.ANNUAL,
          year,
        },
      },
    });

    if (!existing) {
      return this.prisma.hrLeaveBalance.create({
        data: {
          employeeProfileId,
          leaveType: HR_LEAVE_TYPE.ANNUAL,
          year,
          totalDays: entitlement.totalDays,
          usedDays: 0,
          pendingDays: 0,
        },
      });
    }

    const used = Number(existing.usedDays);
    const pending = Number(existing.pendingDays);
    const totalDays = Math.max(entitlement.totalDays, used + pending);
    if (Number(existing.totalDays) === totalDays) return existing;

    return this.prisma.hrLeaveBalance.update({
      where: { id: existing.id },
      data: { totalDays },
    });
  }

  private assertCanSupervise(user: AuthUser) {
    if (!this.canSupervise(user)) {
      throw new ForbiddenException('Personel denetim yetkisi yok');
    }
  }

  async listEmployeeProfiles(user: AuthUser) {
    this.assertCanSupervise(user);
    const year = new Date().getFullYear();
    const profiles = await this.prisma.hrEmployeeProfile.findMany({
      where: { status: 'active' },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        department: { select: { id: true, name: true } },
        leaveBalances: {
          where: { leaveType: HR_LEAVE_TYPE.ANNUAL, year },
          take: 1,
        },
      },
      orderBy: [{ user: { lastName: 'asc' } }, { user: { firstName: 'asc' } }],
    });

    return profiles.map((p) => {
      const entitlement = annualLeaveEntitlementDays(p.hireDate);
      const balance = p.leaveBalances[0];
      const totalDays = balance ? Number(balance.totalDays) : entitlement.totalDays;
      const usedDays = balance ? Number(balance.usedDays) : 0;
      const pendingDays = balance ? Number(balance.pendingDays) : 0;
      return {
        id: p.id,
        userId: p.userId,
        personnelNo: p.personnelNo,
        hireDate: p.hireDate,
        status: p.status,
        user: p.user,
        department: p.department,
        leaveEntitlement: entitlement,
        leaveBalance: {
          year,
          totalDays,
          usedDays,
          pendingDays,
          remainingDays: totalDays - usedDays - pendingDays,
        },
      };
    });
  }

  async listUsersWithoutProfile(user: AuthUser) {
    this.assertCanSupervise(user);
    const linked = await this.prisma.hrEmployeeProfile.findMany({
      select: { userId: true },
    });
    const linkedIds = linked.map((l) => l.userId);
    return this.prisma.user.findMany({
      where: {
        id: { notIn: linkedIds.length ? linkedIds : ['__none__'] },
        status: 'active',
        role: {
          code: {
            in: [
              'admin',
              'ADMIN',
              'manager',
              'MANAGER',
              'office_staff',
              'OFFICE_STAFF',
              'field_staff',
              'FIELD_STAFF',
              'finance',
              'FINANCE',
              'accountant',
              'ACCOUNTANT',
            ],
          },
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: { select: { code: true, name: true } },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take: 200,
    });
  }

  /** Ay sonu toplu rapor — dönem içinde onaylı izinler (izin formu eki için). */
  async listApprovedLeavesForPeriod(user: AuthUser, year: number, month: number) {
    this.assertCanSupervise(user);
    const { start, end } = this.monthRange(year, month);
    return this.prisma.hrLeaveRequest.findMany({
      where: {
        status: HR_LEAVE_STATUS.APPROVED,
        startDate: { lte: end },
        endDate: { gte: start },
      },
      include: {
        employeeProfile: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
            department: { select: { id: true, name: true } },
          },
        },
        approvedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ startDate: 'asc' }],
    });
  }

  /** Ay sonu toplu rapor — kadrodaki aktif tüm personelin profil bilgisi (izin/puantaj denetimi dışında). */
  async listActiveEmployeeProfilesForPeriod(user: AuthUser) {
    this.assertCanSupervise(user);
    return this.prisma.hrEmployeeProfile.findMany({
      where: { status: 'active' },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        department: { select: { id: true, name: true } },
      },
      orderBy: [{ user: { lastName: 'asc' } }, { user: { firstName: 'asc' } }],
    });
  }

  /** Özet Ve Denetim ekranı — gün sonu puantaj onay durumu (gerçek veri). */
  async getDayEndSupervisionSummary(user: AuthUser) {
    this.assertCanSupervise(user);
    const todayKey = this.todayKeyInIstanbul();
    const targetDate = this.toDateOnly(todayKey);
    const workDateLabel = targetDate.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });

    const [profiles, mySummary] = await Promise.all([
      this.prisma.hrEmployeeProfile.findMany({
        where: { status: 'active' },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: { select: { name: true } },
            },
          },
          department: { select: { id: true, name: true } },
          leaveBalances: { where: { leaveType: HR_LEAVE_TYPE.ANNUAL, year: targetDate.getUTCFullYear() }, take: 1 },
        },
        orderBy: [{ user: { lastName: 'asc' } }, { user: { firstName: 'asc' } }],
      }),
      this.getSummary(user),
    ]);

    let approved = 0;
    let notApproved = 0;
    let onLeave = 0;

    const employees = await Promise.all(
      profiles.map(async (profile) => {
        const [entry, approvedLeaves] = await Promise.all([
          this.prisma.hrAttendanceEntry.findFirst({
            where: {
              employeeProfileId: profile.id,
              workDate: targetDate,
              entryType: HR_ATTENDANCE_ENTRY_TYPE.REGULAR,
            },
          }),
          this.prisma.hrLeaveRequest.findMany({
            where: {
              employeeProfileId: profile.id,
              status: HR_LEAVE_STATUS.APPROVED,
              startDate: { lte: targetDate },
              endDate: { gte: targetDate },
            },
            select: { startDate: true, endDate: true },
          }),
        ]);

        const auto = this.resolveAutoStatus(todayKey, approvedLeaves);
        const entitlement = annualLeaveEntitlementDays(profile.hireDate);
        const balance = profile.leaveBalances[0];
        const totalDays = balance ? Number(balance.totalDays) : entitlement.totalDays;
        const usedDays = balance ? Number(balance.usedDays) : 0;
        const pendingDays = balance ? Number(balance.pendingDays) : 0;
        const remainingLeaveDays = totalDays - usedDays - pendingDays;

        let status: 'missing' | 'ok' | 'on_leave';
        let lastConfirmedDate: string | null = null;
        const missingDates: string[] = [];

        if (auto?.status === HR_ATTENDANCE_STATUS.LEAVE) {
          status = 'on_leave';
          onLeave += 1;
        } else if (entry?.employeeConfirmedAt) {
          status = 'ok';
          lastConfirmedDate = this.dateKeyFromUtcDate(entry.employeeConfirmedAt);
          approved += 1;
        } else if (
          auto?.status === HR_ATTENDANCE_STATUS.WEEKLY_REST
          || auto?.status === HR_ATTENDANCE_STATUS.HOLIDAY
        ) {
          status = 'ok';
          approved += 1;
        } else {
          status = 'missing';
          missingDates.push(todayKey);
          notApproved += 1;
        }

        return {
          id: profile.id,
          fullName: `${profile.user.firstName ?? ''} ${profile.user.lastName ?? ''}`.trim(),
          email: profile.user.email,
          department: profile.department?.name ?? '—',
          roleLabel: profile.user.role?.name ?? '—',
          remainingLeaveDays,
          missingDates,
          lastConfirmedDate,
          status,
          proxyName: null as string | null,
        };
      }),
    );

    return {
      cutoffLabel: '18:00',
      workDateLabel,
      workDate: todayKey,
      totals: {
        totalEmployees: profiles.length,
        approved,
        notApproved,
        onLeave,
      },
      myLeaveBalance: {
        leaveTypeLabel: mySummary.leaveBalance.leaveTypeLabel,
        year: mySummary.leaveBalance.year,
        remainingDays: mySummary.leaveBalance.remainingDays,
        totalDays: mySummary.leaveBalance.totalDays,
        usedDays: mySummary.leaveBalance.usedDays,
        pendingDays: mySummary.leaveBalance.pendingDays,
      },
      employees,
    };
  }

  /** "Onaylamayanlara Mail Gönder" — gün sonu puantajı onaylanmayan personele hatırlatma alıcı listesi. */
  async getMissingAttendanceRecipients(user: AuthUser) {
    const data = await this.getDayEndSupervisionSummary(user);
    return data.employees.filter((e) => e.status === 'missing' && e.email);
  }

  async upsertEmployeeProfile(user: AuthUser, dto: UpsertEmployeeProfileDto) {
    this.assertCanSupervise(user);

    const targetUser = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { id: true, firstName: true, lastName: true, email: true },
    });
    if (!targetUser) throw new NotFoundException('Kullanıcı bulunamadı');

    const hireDate =
      dto.hireDate === null
        ? null
        : dto.hireDate
          ? this.toDateOnly(dto.hireDate)
          : undefined;

    const personnelNo =
      dto.personnelNo === undefined
        ? undefined
        : dto.personnelNo?.trim()
          ? dto.personnelNo.trim()
          : null;

    const existing = await this.prisma.hrEmployeeProfile.findUnique({
      where: { userId: dto.userId },
    });

    const profile = existing
      ? await this.prisma.hrEmployeeProfile.update({
          where: { id: existing.id },
          data: {
            ...(hireDate !== undefined ? { hireDate } : {}),
            ...(personnelNo !== undefined ? { personnelNo } : {}),
            ...(dto.departmentId !== undefined
              ? { departmentId: dto.departmentId }
              : {}),
            ...(dto.managerUserId !== undefined
              ? { managerUserId: dto.managerUserId }
              : {}),
            status: 'active',
          },
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
            department: { select: { id: true, name: true } },
          },
        })
      : await this.prisma.hrEmployeeProfile.create({
          data: {
            userId: dto.userId,
            hireDate: hireDate ?? null,
            personnelNo: personnelNo ?? null,
            departmentId: dto.departmentId ?? null,
            managerUserId: dto.managerUserId ?? null,
            status: 'active',
          },
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
            department: { select: { id: true, name: true } },
          },
        });

    const year = new Date().getFullYear();
    const balance = await this.ensureAnnualBalance(profile.id, year, profile.hireDate);
    const entitlement = annualLeaveEntitlementDays(profile.hireDate);

    return {
      profile,
      leaveEntitlement: entitlement,
      leaveBalance: {
        year,
        totalDays: Number(balance.totalDays),
        usedDays: Number(balance.usedDays),
        pendingDays: Number(balance.pendingDays),
        remainingDays:
          Number(balance.totalDays) -
          Number(balance.usedDays) -
          Number(balance.pendingDays),
      },
      note:
        'Kıdem ve ihbar tazminatı hesabı sonraki fazdadır; bu adım yalnızca yıllık izin hakedişini günceller.',
    };
  }

  async getSummary(user: AuthUser) {
    const profile = await this.ensureEmployeeProfile(this.authUserId(user));
    const year = new Date().getFullYear();
    const balance = await this.ensureAnnualBalance(profile.id, year, profile.hireDate);

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

    const todayKey = this.todayKeyInIstanbul();
    const todayDate = this.toDateOnly(todayKey);
    const [todayEntry, todayApprovedLeaves] = await Promise.all([
      this.prisma.hrAttendanceEntry.findFirst({
        where: {
          employeeProfileId: profile.id,
          workDate: todayDate,
          entryType: HR_ATTENDANCE_ENTRY_TYPE.REGULAR,
        },
      }),
      this.prisma.hrLeaveRequest.findMany({
        where: {
          employeeProfileId: profile.id,
          status: HR_LEAVE_STATUS.APPROVED,
          startDate: { lte: todayDate },
          endDate: { gte: todayDate },
        },
        select: { startDate: true, endDate: true },
      }),
    ]);
    const todayAuto = this.resolveAutoStatus(todayKey, todayApprovedLeaves);
    const todayPending = !todayAuto && !todayEntry?.employeeConfirmedAt;
    const workDateLabel = todayDate.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });

    return {
      dayEndWarning: {
        pending: todayPending,
        workDateLabel,
        cutoffLabel: '18:00',
        message: todayPending ? 'Lütfen bugünkü puantajınızı onaylayınız.' : null,
      },
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
      canSupervise: this.canSupervise(user),
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
    return this.listAttendanceForProfile(profile.id, profile.userId, year, month);
  }

  /** Denetim: admin/yönetici/finans başka bir personelin puantajını salt okunur görüntüler. */
  async getAttendanceForEmployee(
    user: AuthUser,
    employeeProfileId: string,
    year: number,
    month: number,
  ) {
    this.assertCanSupervise(user);
    const profile = await this.prisma.hrEmployeeProfile.findUnique({
      where: { id: employeeProfileId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        department: { select: { id: true, name: true } },
      },
    });
    if (!profile) {
      throw new NotFoundException('Personel bulunamadı');
    }
    const attendance = await this.listAttendanceForProfile(profile.id, profile.userId, year, month);
    return {
      ...attendance,
      employee: {
        id: profile.id,
        userId: profile.userId,
        name: `${profile.user.firstName ?? ''} ${profile.user.lastName ?? ''}`.trim(),
        department: profile.department?.name ?? null,
      },
    };
  }

  private async listAttendanceForProfile(
    employeeProfileId: string,
    activityUserId: string,
    year: number,
    month: number,
  ) {
    const profileId = employeeProfileId;
    const { start, end } = this.monthRange(year, month);

    const [entries, activitySessions, approvedLeaves, periodLock] = await Promise.all([
      this.prisma.hrAttendanceEntry.findMany({
        where: {
          employeeProfileId: profileId,
          workDate: { gte: start, lte: end },
        },
        orderBy: { workDate: 'asc' },
      }),
      this.prisma.activitySession.findMany({
        where: {
          userId: activityUserId,
          sessionDate: { gte: start, lte: end },
        },
        orderBy: { sessionDate: 'asc' },
      }),
      this.prisma.hrLeaveRequest.findMany({
        where: {
          employeeProfileId: profileId,
          status: HR_LEAVE_STATUS.APPROVED,
          startDate: { lte: end },
          endDate: { gte: start },
        },
        select: { startDate: true, endDate: true },
      }),
      this.getPeriodLock(profileId, year, month),
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

      const attendanceStatus = entry?.attendanceStatus ?? auto?.status ?? null;
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
    return this.confirmDayForProfile(profile.id, this.authUserId(user), dto.workDate, {
      minutesWorked: dto.minutesWorked,
      notes: dto.notes,
      clockInAt: dto.clockInAt,
      clockOutAt: dto.clockOutAt,
    });
  }

  /** Ay içindeki tüm bekleyen (onaysız) günleri tek adımda onaylar. */
  async confirmPendingAttendanceDays(user: AuthUser, year: number, month: number) {
    const profile = await this.ensureEmployeeProfile(this.authUserId(user));
    const periodLock = await this.getPeriodLock(profile.id, year, month);
    this.assertPeriodNotLocked(periodLock?.lockedAt);

    const attendance = await this.listAttendanceForProfile(profile.id, profile.userId, year, month);
    const todayKey = this.todayKeyInIstanbul();
    const pendingDates = attendance.days
      .filter(
        (d) =>
          !d.isFuture
          && d.date <= todayKey
          && d.attendanceStatus !== HR_ATTENDANCE_STATUS.WEEKLY_REST
          && d.attendanceStatus !== HR_ATTENDANCE_STATUS.HOLIDAY
          && d.attendanceStatus !== HR_ATTENDANCE_STATUS.LEAVE
          && !d.employeeConfirmedAt,
      )
      .map((d) => d.date);

    for (const workDate of pendingDates) {
      await this.confirmDayForProfile(profile.id, this.authUserId(user), workDate, {});
    }

    return { confirmedCount: pendingDates.length, dates: pendingDates };
  }

  private async confirmDayForProfile(
    employeeProfileId: string,
    confirmedByUserId: string,
    workDateStr: string,
    opts: { minutesWorked?: number; notes?: string; clockInAt?: string; clockOutAt?: string },
  ) {
    const workDate = this.toDateOnly(workDateStr);
    const dateKey = this.dateKeyFromUtcDate(workDate);
    const todayKey = this.todayKeyInIstanbul();

    if (dateKey > todayKey) {
      throw new BadRequestException('Gelecek günler için onay verilemez');
    }

    const activity = await this.prisma.activitySession.findUnique({
      where: { userId_sessionDate: { userId: confirmedByUserId, sessionDate: workDate } },
    });
    const suggestedMinutes = activity ? Math.round(activity.activeMs / 60_000) : null;

    const approvedLeaves = await this.prisma.hrLeaveRequest.findMany({
      where: {
        employeeProfileId,
        status: HR_LEAVE_STATUS.APPROVED,
        startDate: { lte: workDate },
        endDate: { gte: workDate },
      },
      select: { startDate: true, endDate: true },
    });
    const auto = this.resolveAutoStatus(dateKey, approvedLeaves);
    const defaultStatus = auto?.status ?? HR_ATTENDANCE_STATUS.PRESENT;
    const activityClocks = this.clockTimesFromActivity(activity);
    const clockInAt = this.parseOptionalDateTime(opts.clockInAt) ?? activityClocks.clockInAt;
    const clockOutAt = this.parseOptionalDateTime(opts.clockOutAt) ?? activityClocks.clockOutAt;

    const entry = await this.prisma.hrAttendanceEntry.upsert({
      where: {
        employeeProfileId_workDate_entryType: {
          employeeProfileId,
          workDate,
          entryType: HR_ATTENDANCE_ENTRY_TYPE.REGULAR,
        },
      },
      update: {
        attendanceStatus: defaultStatus,
        minutesWorked: opts.minutesWorked ?? suggestedMinutes,
        suggestedMinutes,
        clockInAt,
        clockOutAt,
        notes: opts.notes,
        source: 'employee_confirm',
        employeeConfirmedAt: new Date(),
        employeeConfirmedByUserId: confirmedByUserId,
      },
      create: {
        employeeProfileId,
        workDate,
        entryType: HR_ATTENDANCE_ENTRY_TYPE.REGULAR,
        attendanceStatus: defaultStatus,
        minutesWorked: opts.minutesWorked ?? suggestedMinutes,
        suggestedMinutes,
        clockInAt,
        clockOutAt,
        notes: opts.notes,
        source: 'employee_confirm',
        employeeConfirmedAt: new Date(),
        employeeConfirmedByUserId: confirmedByUserId,
        createdByUserId: confirmedByUserId,
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

  /** Ayarlar → Tanımlar → Personel altında yönetilen aktif izin türü kodlarını doğrular. */
  private async assertValidLeaveType(leaveType: string): Promise<void> {
    const types = await this.systemSettings.getHrLeaveTypes();
    const active = types.some((t) => t.code === leaveType && t.active !== false);
    if (!active) {
      throw new BadRequestException('Geçersiz izin türü. Lütfen ayarlarda tanımlı bir tür seçin.');
    }
  }

  async createLeaveRequest(user: AuthUser, dto: CreateLeaveRequestDto) {
    await this.assertValidLeaveType(dto.leaveType);
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
      const balance = await this.ensureAnnualBalance(profile.id, year, profile.hireDate);
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
      const balance = await this.ensureAnnualBalance(
        profile.id,
        request.startDate.getUTCFullYear(),
        profile.hireDate,
      );
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

  /** Tüm personelin tüm izin geçmişi — yalnızca izin onay yetkisi olanlar (Admin/Finans/Yönetici) görebilir. */
  async listAllLeaveRequests(user: AuthUser) {
    if (!this.canApprove(user)) {
      throw new ForbiddenException('İzin onay yetkiniz yok');
    }

    const requests = await this.prisma.hrLeaveRequest.findMany({
      where: { status: { not: HR_LEAVE_STATUS.DRAFT } },
      include: {
        employeeProfile: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
            department: { select: { id: true, name: true } },
          },
        },
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
        rejectedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    return requests.map((r) => ({
      ...r,
      employeeName: `${r.employeeProfile.user.firstName ?? ''} ${r.employeeProfile.user.lastName ?? ''}`.trim(),
      department: r.employeeProfile.department?.name ?? null,
      decidedByName: r.approvedBy
        ? `${r.approvedBy.firstName ?? ''} ${r.approvedBy.lastName ?? ''}`.trim()
        : r.rejectedBy
          ? `${r.rejectedBy.firstName ?? ''} ${r.rejectedBy.lastName ?? ''}`.trim()
          : null,
      decidedAt: r.approvedAt ?? r.rejectedAt ?? null,
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
        request.employeeProfile?.hireDate,
      );
      await this.prisma.hrLeaveBalance.update({
        where: { id: balance.id },
        data: {
          pendingDays: { decrement: request.dayCount },
          usedDays: { increment: request.dayCount },
        },
      });
    }

    await this.notifyLeaveDecision(request, 'approved');

    return updated;
  }

  async rejectLeaveRequest(user: AuthUser, id: string, rejectionReason?: string) {
    if (!this.canApprove(user)) {
      throw new ForbiddenException('İzin onay yetkiniz yok');
    }

    const request = await this.prisma.hrLeaveRequest.findUnique({
      where: { id },
      include: { employeeProfile: true },
    });
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
        request.employeeProfile?.hireDate,
      );
      await this.prisma.hrLeaveBalance.update({
        where: { id: balance.id },
        data: { pendingDays: { decrement: request.dayCount } },
      });
    }

    await this.notifyLeaveDecision(request, 'rejected', rejectionReason);

    return updated;
  }

  /** Onay/red sonrası personele in-app bildirim — bildirim çanı `notification` tablosunu okur. */
  private async notifyLeaveDecision(
    request: {
      id: string;
      employeeProfileId: string;
      startDate: Date;
      endDate: Date;
      employeeProfile?: { userId: string } | null;
    },
    decision: 'approved' | 'rejected',
    rejectionReason?: string,
  ): Promise<void> {
    const employeeProfile =
      request.employeeProfile
      ?? (await this.prisma.hrEmployeeProfile.findUnique({
        where: { id: request.employeeProfileId },
        select: { userId: true },
      }));
    if (!employeeProfile?.userId) return;

    const dateRange = `${this.formatDateTrLong(request.startDate)} – ${this.formatDateTrLong(request.endDate)}`;
    const isApproved = decision === 'approved';

    await this.prisma.notification.create({
      data: {
        userId: employeeProfile.userId,
        type: isApproved ? 'hr_leave_approved' : 'hr_leave_rejected',
        title: isApproved ? 'İzin Talebiniz Onaylandı' : 'İzin Talebiniz Reddedildi',
        body: isApproved
          ? `${dateRange} tarihli izin talebiniz onaylandı.`
          : `${dateRange} tarihli izin talebiniz reddedildi.${rejectionReason ? ` Neden: ${rejectionReason}` : ''}`,
        channel: 'in_app',
        status: 'unread',
        relatedEntityType: 'hr_leave_request',
        relatedEntityId: request.id,
      },
    });
  }

  private formatDateTrLong(date: Date): string {
    return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  }

  private mapAssetRow(asset: {
    id: string;
    assetCode: string;
    name: string;
    category: string | null;
    serialNumber: string | null;
    notes: string | null;
    createdAt: Date;
    assignedEmployee: {
      id: string;
      department: { name: string } | null;
      user: { firstName: string | null; lastName: string | null };
    } | null;
  }) {
    const brandModel = this.parseBrandModel(asset.name, asset.notes);
    return {
      id: asset.id,
      assetCode: asset.assetCode,
      employeeProfileId: asset.assignedEmployee?.id ?? null,
      employeeName: asset.assignedEmployee
        ? `${asset.assignedEmployee.user.firstName ?? ''} ${asset.assignedEmployee.user.lastName ?? ''}`.trim()
        : '—',
      department: asset.assignedEmployee?.department?.name ?? '—',
      category: asset.category ?? 'other',
      name: asset.name,
      brand: brandModel.brand,
      model: brandModel.model,
      serialNo: asset.serialNumber ?? '—',
      assignedAt: asset.createdAt.toISOString().slice(0, 10),
    };
  }

  private parseBrandModel(name: string, notes: string | null) {
    if (notes) {
      try {
        const parsed = JSON.parse(notes) as { brand?: string; model?: string };
        if (parsed.brand || parsed.model) {
          return { brand: parsed.brand ?? '', model: parsed.model ?? '' };
        }
      } catch {
        /* düz metin not olabilir */
      }
    }
    const parts = name.trim().split(/\s+/);
    if (parts.length <= 1) return { brand: name, model: '' };
    return { brand: parts[0], model: parts.slice(1).join(' ') };
  }

  async listAssignedAssets(user: AuthUser, employeeProfileId?: string) {
    const canManage = this.canSupervise(user) || this.canApprove(user);
    const myProfile = await this.ensureEmployeeProfile(this.authUserId(user));
    const targetId = employeeProfileId || myProfile.id;
    if (!canManage && targetId !== myProfile.id) {
      throw new ForbiddenException('Başka personelin zimmetini görme yetkiniz yok');
    }

    const assets = await this.prisma.fixedAsset.findMany({
      where: {
        status: 'active',
        archivedAt: null,
        ...(canManage && !employeeProfileId
          ? { assignedEmployeeId: { not: null } }
          : { assignedEmployeeId: targetId }),
      },
      include: {
        assignedEmployee: {
          include: {
            user: { select: { firstName: true, lastName: true } },
            department: { select: { name: true } },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    return assets.map((a) => this.mapAssetRow(a));
  }

  async createAssignedAsset(
    user: AuthUser,
    dto: {
      employeeProfileId: string;
      category: string;
      brand: string;
      model: string;
      serialNumber: string;
      notes?: string;
    },
  ) {
    if (!this.canSupervise(user) && !this.canApprove(user)) {
      throw new ForbiddenException('Zimmet ekleme yetkiniz yok');
    }

    const profile = await this.prisma.hrEmployeeProfile.findUnique({
      where: { id: dto.employeeProfileId },
      include: {
        user: { select: { firstName: true, lastName: true } },
        department: { select: { name: true } },
      },
    });
    if (!profile || profile.status !== 'active') {
      throw new NotFoundException('Personel profili bulunamadı');
    }

    const brand = dto.brand.trim();
    const model = dto.model.trim();
    const serialNumber = dto.serialNumber.trim().toUpperCase();
    const name = `${brand} ${model}`.trim();
    const assetCode = `ZM-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    const created = await this.prisma.fixedAsset.create({
      data: {
        assetCode,
        name,
        category: dto.category.trim().toLowerCase().slice(0, 40),
        serialNumber,
        assignedEmployeeId: profile.id,
        status: 'active',
        notes: JSON.stringify({ brand, model, meta: dto.notes?.trim() || null }),
      },
      include: {
        assignedEmployee: {
          include: {
            user: { select: { firstName: true, lastName: true } },
            department: { select: { name: true } },
          },
        },
      },
    });

    return this.mapAssetRow(created);
  }

  async getLeaveBalances(user: AuthUser) {
    const profile = await this.ensureEmployeeProfile(this.authUserId(user));
    const year = new Date().getFullYear();
    const balance = await this.ensureAnnualBalance(profile.id, year, profile.hireDate);
    return [balance];
  }
}
