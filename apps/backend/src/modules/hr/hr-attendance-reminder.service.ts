import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { PlatformModulesService, PLATFORM_MODULE_CODES } from '@/modules/platform-modules/platform-modules.service';
import { SystemSettingsService } from '@/modules/system-settings/system-settings.service';
import { EmailService } from '@/modules/notifications/email/email.service';
import { HrService } from './hr.service';
import { belongsOnHrPersonnelRoster } from '@sigorta/shared';

type AuthUser = {
  id?: string;
  userId?: string;
  roleCode?: string | null;
  permissions?: string[];
};

export type HrAttendanceMonthCloseReminder = {
  year: number;
  month: number;
  periodLabel: string;
  urgency: 'month_end' | 'overdue';
  audience: 'employee' | 'finance';
  message: string;
  checklist: string[];
  stats?: {
    totalEmployees: number;
    pendingDailyConfirmEmployees: number;
    missingMonthlyConfirm: number;
    missingLock: number;
  };
};

const MONTH_LABELS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

const FINANCE_CHECKLIST = [
  'Personel günlük ve aylık puantaj onaylarını tamamlasın',
  'İK ay kilidi uygulasın',
  'Mali müşavir çıktısını gönderin veya arşivleyin',
  'Bordro öncesi denetim notunu işleyin',
];

const EMPLOYEE_CHECKLIST = [
  'Geçmiş iş günlerinde Onayla ile teyit verin',
  'Ay sonunda Aylık Onay butonuna basın',
  'İzin günlerinin puantajda İzinli göründüğünü kontrol edin',
];

const FINANCE_ROLE_CODES = new Set([
  'admin', 'super_admin', 'manager', 'finance', 'finans', 'accountant',
]);

@Injectable()
export class HrAttendanceReminderService {
  private readonly logger = new Logger(HrAttendanceReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly hrService: HrService,
    private readonly platformModules: PlatformModulesService,
    private readonly systemSettings: SystemSettingsService,
    private readonly email: EmailService,
  ) {}

  async getMonthCloseReminders(user: AuthUser): Promise<{
    reminders: HrAttendanceMonthCloseReminder[];
    hasPending: boolean;
    criticalCount: number;
  }> {
    const enabled = await this.platformModules.isEnabled(PLATFORM_MODULE_CODES.PERSONNEL);
    if (!enabled) {
      return { reminders: [], hasPending: false, criticalCount: 0 };
    }

    const reminders: HrAttendanceMonthCloseReminder[] = [];
    const isFinance = this.isFinanceOrAuditUser(user);

    for (const period of this.buildPeriodsToCheck(new Date())) {
      if (isFinance) {
        const aggregate = await this.aggregateMonthClose(period.year, period.month);
        const inWindow = this.isPeriodInReminderWindow(period.year, period.month);
        if (aggregate.needsAttention) {
          reminders.push(this.buildFinanceReminder(period, aggregate));
        } else if (inWindow) {
          reminders.push(this.buildFinanceInfoReminder(period, aggregate));
        }
      } else {
        const personal = await this.getPersonalMonthClose(user, period.year, period.month);
        if (personal.needsAttention) {
          reminders.push(this.buildEmployeeReminder(period, personal));
        }
      }
    }

    const criticalCount = reminders.filter((r) => r.urgency === 'overdue').length;
    return {
      reminders,
      hasPending: reminders.length > 0,
      criticalCount,
    };
  }

  /** Günlük cron — panel bildirimi ve isteğe bağlı e-posta */
  async processDailyReminders(): Promise<{ employeeSent: number; financeSent: number }> {
    const enabled = await this.platformModules.isEnabled(PLATFORM_MODULE_CODES.PERSONNEL);
    if (!enabled) {
      return { employeeSent: 0, financeSent: 0 };
    }

    const signalActive = await this.isSignalRuleActive();
    if (!signalActive) {
      this.logger.log('Puantaj ay kapanış sinyali kapalı — hatırlatma atlandı');
      return { employeeSent: 0, financeSent: 0 };
    }

    const now = new Date();
    const periods = this.buildPeriodsToCheck(now);
    if (periods.length === 0) {
      return { employeeSent: 0, financeSent: 0 };
    }

    let employeeSent = 0;
    let financeSent = 0;

    const profiles = await this.prisma.hrEmployeeProfile.findMany({
      where: { status: 'active', personnelNo: { not: null } },
      select: {
        userId: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            role: { select: { code: true } },
          },
        },
      },
    });
    const rosterProfiles = profiles.filter((p) =>
      belongsOnHrPersonnelRoster({
        firstName: p.user.firstName,
        lastName: p.user.lastName,
        email: p.user.email,
        roleCode: p.user.role?.code,
      }),
    );

    for (const period of periods) {
      for (const profile of rosterProfiles) {
        const personal = await this.getPersonalMonthClose({ id: profile.userId }, period.year, period.month);
        if (!personal.needsAttention) continue;

        const periodKey = this.periodKey(period.year, period.month);
        const already = await this.alreadyNotified(
          profile.userId,
          'hr_attendance_month_end_employee',
          periodKey,
          period.urgency === 'overdue' ? 48 : 24,
        );
        if (already) continue;

        const reminder = this.buildEmployeeReminder(period, personal);
        await this.createInAppNotification(
          profile.userId,
          'hr_attendance_month_end_employee',
          periodKey,
          'Puantaj Ay Sonu Hatırlatması',
          reminder.message,
        );
        employeeSent += 1;
      }

      const aggregate = await this.aggregateMonthClose(period.year, period.month);
      if (!aggregate.needsAttention) continue;

      const financeUsers = await this.findFinanceAndAuditUsers();
      const reminder = this.buildFinanceReminder(period, aggregate);

      for (const fu of financeUsers) {
        const periodKey = this.periodKey(period.year, period.month);
        const already = await this.alreadyNotified(
          fu.id,
          'hr_attendance_month_close_finance',
          periodKey,
          period.urgency === 'overdue' ? 48 : 24,
        );
        if (already) continue;

        await this.createInAppNotification(
          fu.id,
          'hr_attendance_month_close_finance',
          periodKey,
          'Puantaj Denetim Hatırlatması',
          reminder.message,
        );
        financeSent += 1;

        if (await this.shouldSendEmail()) {
          await this.sendReminderEmail(fu.email, reminder);
        }
      }
    }

    this.logger.log(`Puantaj hatırlatma: personel=${employeeSent}, finans/denetim=${financeSent}`);
    return { employeeSent, financeSent };
  }

  private buildEmployeeReminder(
    period: { year: number; month: number; urgency: 'month_end' | 'overdue' },
    personal: { pendingDays: number; missingMonthlyConfirm: boolean },
  ): HrAttendanceMonthCloseReminder {
    const periodLabel = this.periodLabel(period.year, period.month);
    let message: string;
    if (personal.pendingDays > 0 && personal.missingMonthlyConfirm) {
      message = `${periodLabel} — ${personal.pendingDays} gün onay bekliyor; aylık onay da tamamlanmadı.`;
    } else if (personal.pendingDays > 0) {
      message = `${periodLabel} — ${personal.pendingDays} iş günü için puantaj onayı bekliyor.`;
    } else {
      message = `${periodLabel} — aylık puantaj onayını tamamlayın.`;
    }

    return {
      year: period.year,
      month: period.month,
      periodLabel,
      urgency: period.urgency,
      audience: 'employee',
      message,
      checklist: EMPLOYEE_CHECKLIST,
    };
  }

  private buildFinanceReminder(
    period: { year: number; month: number; urgency: 'month_end' | 'overdue' },
    aggregate: MonthCloseAggregate,
  ): HrAttendanceMonthCloseReminder {
    const periodLabel = this.periodLabel(period.year, period.month);
    const message = period.urgency === 'overdue'
      ? `${periodLabel} puantajı kapanmadı — ${aggregate.missingLock} personelde ay kilidi yok, ${aggregate.missingMonthlyConfirm} personelde aylık onay eksik.`
      : `${periodLabel} ayı kapanıyor — puantaj onayları, ay kilidi ve mali müşavir çıktısını kontrol edin.`;

    return this.buildFinanceReminderBase(period, message, aggregate);
  }

  private buildFinanceInfoReminder(
    period: { year: number; month: number; urgency: 'month_end' | 'overdue' },
    aggregate: MonthCloseAggregate,
  ): HrAttendanceMonthCloseReminder {
    const periodLabel = this.periodLabel(period.year, period.month);
    const message = aggregate.totalEmployees === 0
      ? `${periodLabel} — personel profili bulunamadı; puantaj süreci için önce personel kartlarını tanımlayın.`
      : `${periodLabel} — ay kapanış kontrol listesini gözden geçirin (onaylar tamam görünüyor).`;

    return this.buildFinanceReminderBase(period, message, aggregate);
  }

  private buildFinanceReminderBase(
    period: { year: number; month: number; urgency: 'month_end' | 'overdue' },
    message: string,
    aggregate: MonthCloseAggregate,
  ): HrAttendanceMonthCloseReminder {
    const periodLabel = this.periodLabel(period.year, period.month);
    return {
      year: period.year,
      month: period.month,
      periodLabel,
      urgency: period.urgency,
      audience: 'finance',
      message,
      checklist: FINANCE_CHECKLIST,
      stats: {
        totalEmployees: aggregate.totalEmployees,
        pendingDailyConfirmEmployees: aggregate.pendingDailyConfirmEmployees,
        missingMonthlyConfirm: aggregate.missingMonthlyConfirm,
        missingLock: aggregate.missingLock,
      },
    };
  }

  private async getPersonalMonthClose(user: AuthUser, year: number, month: number) {
    try {
      const attendance = await this.hrService.listAttendance(user, year, month);
      const pendingDays = attendance.summary.pendingConfirmationDays;
      const missingMonthlyConfirm = !attendance.periodLock?.employeeConfirmedAt;
      const inWindow = this.isPeriodInReminderWindow(year, month);
      const needsAttention = inWindow && (pendingDays > 0 || missingMonthlyConfirm);
      return { pendingDays, missingMonthlyConfirm, needsAttention };
    } catch {
      return { pendingDays: 0, missingMonthlyConfirm: false, needsAttention: false };
    }
  }

  private async aggregateMonthClose(year: number, month: number): Promise<MonthCloseAggregate & { needsAttention: boolean }> {
    const profiles = await this.prisma.hrEmployeeProfile.findMany({
      where: { status: 'active', personnelNo: { not: null } },
      select: {
        userId: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            role: { select: { code: true } },
          },
        },
      },
    });
    const rosterProfiles = profiles.filter((p) =>
      belongsOnHrPersonnelRoster({
        firstName: p.user.firstName,
        lastName: p.user.lastName,
        email: p.user.email,
        roleCode: p.user.role?.code,
      }),
    );

    let pendingDailyConfirmEmployees = 0;
    let missingMonthlyConfirm = 0;
    let missingLock = 0;

    for (const profile of rosterProfiles) {
      try {
        const attendance = await this.hrService.listAttendance({ id: profile.userId }, year, month);
        if (attendance.summary.pendingConfirmationDays > 0) pendingDailyConfirmEmployees += 1;
        if (!attendance.periodLock?.employeeConfirmedAt) missingMonthlyConfirm += 1;
        if (!attendance.periodLock?.lockedAt) missingLock += 1;
      } catch {
        missingMonthlyConfirm += 1;
        missingLock += 1;
      }
    }

    const inWindow = this.isPeriodInReminderWindow(year, month);
    const needsAttention = inWindow && (
      pendingDailyConfirmEmployees > 0
      || missingMonthlyConfirm > 0
      || missingLock > 0
    );

    return {
      totalEmployees: rosterProfiles.length,
      pendingDailyConfirmEmployees,
      missingMonthlyConfirm,
      missingLock,
      needsAttention,
    };
  }

  private buildPeriodsToCheck(now: Date): Array<{ year: number; month: number; urgency: 'month_end' | 'overdue' }> {
    const { year, month, day } = this.istanbulParts(now);
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const periods: Array<{ year: number; month: number; urgency: 'month_end' | 'overdue' }> = [];

    const isMonthEndWindow = day >= 25;
    if (isMonthEndWindow) {
      periods.push({ year, month, urgency: day >= daysInMonth - 2 ? 'month_end' : 'month_end' });
    }

    if (day <= 5) {
      const prev = this.previousMonth(year, month);
      periods.push({ year: prev.year, month: prev.month, urgency: 'overdue' });
    }

    const seen = new Set<string>();
    return periods.filter((p) => {
      const key = this.periodKey(p.year, p.month);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private isPeriodInReminderWindow(year: number, month: number): boolean {
    const { year: cy, month: cm, day } = this.istanbulParts(new Date());
    if (year === cy && month === cm) {
      return day >= 25;
    }
    const prev = this.previousMonth(cy, cm);
    if (year === prev.year && month === prev.month) {
      return day <= 5;
    }
    if (year < cy || (year === cy && month < cm)) {
      return true;
    }
    return false;
  }

  private isFinanceOrAuditUser(user: AuthUser): boolean {
    const role = user.roleCode?.toLowerCase() ?? '';
    if (FINANCE_ROLE_CODES.has(role)) return true;
    const perms = user.permissions ?? [];
    return perms.includes('hr.attendance.manage') || perms.includes('hr.leave.approve');
  }

  private async findFinanceAndAuditUsers() {
    return this.prisma.user.findMany({
      where: {
        status: 'active',
        role: { code: { in: ['admin', 'super_admin', 'manager', 'finance'] } },
      },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
  }

  private async isSignalRuleActive(): Promise<boolean> {
    try {
      const settings = await this.systemSettings.getNotificationSettings();
      const rule = settings.signalRules?.find((r) => r.key === 'hr_attendance_month_close');
      return rule?.active !== false;
    } catch {
      return true;
    }
  }

  private async shouldSendEmail(): Promise<boolean> {
    try {
      const settings = await this.systemSettings.getNotificationSettings();
      if (!settings.emailEnabled) return false;
      const rule = settings.signalRules?.find((r) => r.key === 'hr_attendance_month_close');
      return rule?.channels?.email === true;
    } catch {
      return false;
    }
  }

  private async createInAppNotification(
    userId: string,
    type: string,
    periodKey: string,
    title: string,
    body: string,
  ) {
    await this.prisma.notification.create({
      data: {
        userId,
        type,
        title,
        body,
        channel: 'in_app',
        status: 'unread',
        relatedEntityType: 'hr_attendance_period',
        relatedEntityId: periodKey,
      },
    });
  }

  private async alreadyNotified(
    userId: string,
    type: string,
    periodKey: string,
    withinHours: number,
  ): Promise<boolean> {
    const since = new Date(Date.now() - withinHours * 60 * 60 * 1000);
    const count = await this.prisma.notification.count({
      where: {
        userId,
        type,
        relatedEntityId: periodKey,
        createdAt: { gte: since },
      },
    });
    return count > 0;
  }

  private async sendReminderEmail(to: string, reminder: HrAttendanceMonthCloseReminder) {
    if (!to) return;

    const checklistHtml = reminder.checklist.map((c) => `<li>${c}</li>`).join('');
    const statsHtml = reminder.stats
      ? `<p><strong>Özet:</strong> ${reminder.stats.totalEmployees} personel — `
        + `${reminder.stats.pendingDailyConfirmEmployees} günlük onay bekliyor, `
        + `${reminder.stats.missingMonthlyConfirm} aylık onay eksik, `
        + `${reminder.stats.missingLock} ay kilidi yok.</p>`
      : '';

    const result = await this.email.sendEmail(
      to,
      `Puantaj Denetim Hatırlatması — ${reminder.periodLabel}`,
      `
          <div style="font-family: Arial, sans-serif; max-width: 640px;">
            <h2 style="color: #1a4080;">Puantaj Ay Kapanış Hatırlatması</h2>
            <p>${reminder.message}</p>
            ${statsHtml}
            <p><strong>Kontrol Listesi:</strong></p>
            <ul>${checklistHtml}</ul>
            <p style="font-size: 12px; color: #64748b;">
              Bu hatırlatma bilgilendirme amaçlıdır; dijital puantaj resmi defter yerine geçmez.
              Panel: Personel Özlük → Puantaj
            </p>
          </div>
        `,
    );
    if (!result.sent) {
      this.logger.warn(`Puantaj hatırlatma e-postası gönderilemedi (${to}): ${result.errorMsg}`);
    }
  }

  private istanbulParts(date: Date) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Istanbul',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    }).formatToParts(date);
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
    return { year: get('year'), month: get('month'), day: get('day') };
  }

  private previousMonth(year: number, month: number) {
    if (month === 1) return { year: year - 1, month: 12 };
    return { year, month: month - 1 };
  }

  private periodKey(year: number, month: number) {
    return `${year}-${String(month).padStart(2, '0')}`;
  }

  private periodLabel(year: number, month: number) {
    return `${MONTH_LABELS[month - 1] ?? month} ${year}`;
  }
}

type MonthCloseAggregate = {
  totalEmployees: number;
  pendingDailyConfirmEmployees: number;
  missingMonthlyConfirm: number;
  missingLock: number;
};
