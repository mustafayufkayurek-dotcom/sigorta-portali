import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Response } from 'express';
import * as ExcelJS from 'exceljs';
import { HrService } from './hr.service';
import { CompanyInfo, SystemSettingsService } from '@/modules/system-settings/system-settings.service';
import { EmailService } from '@/modules/notifications/email/email.service';
import { SendAttendanceAccountantDto } from './dto/send-attendance-accountant.dto';
import { HR_ATTENDANCE_STATUS_LABELS, HR_LEAVE_TYPE_LABELS, HrLeaveType } from './hr.constants';

const MAIL_SETUP_ERROR =
  'E-posta gönderilemedi. Ayarlar → E-posta Bildirimleri mail kurulumunu kontrol edin.';

type AuthUser = {
  id?: string;
  userId?: string;
  roleCode?: string | null;
  permissions?: string[];
};

const DISCLAIMER_LINES = [
  'Bu çıktı resmi puantaj defteri yerine geçmez.',
  'Ad-soyad yazarak verilen dijital onay, 5070 sayılı Kanun kapsamında nitelikli elektronik imza değildir; zaman damgalı "adi delil" niteliğindedir.',
  'Mesai giriş/çıkış saatleri panel nabız referansıdır; resmi mesai kartı yerine geçmez.',
  'Bordro hesaplama veya SGK bildirim kaynağı değildir.',
  'Mali müşavir incelemesi için bilgilendirme amaçlıdır; nihai kayıt muhasebe/bordro sürecindedir.',
];

const BULK_DISCLAIMER_LINES = [
  'Bu çıktı resmi puantaj defteri yerine geçmez.',
  'Ad-soyad yazarak verilen dijital onay, 5070 sayılı Kanun kapsamında nitelikli elektronik imza değildir; zaman damgalı "adi delil" niteliğindedir.',
  'İzin formları personel bazlı onaylı izin taleplerinin elektronik kaydıdır; ıslak imzalı evrak yerine geçmez.',
  'Bordro hesaplama veya SGK bildirim kaynağı değildir.',
  'Mali müşavir incelemesi için bilgilendirme amaçlıdır; nihai kayıt muhasebe/bordro sürecindedir.',
];

const WEEKDAY_LABELS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

const MONTH_LABELS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Manuel',
  activity: 'Nabız',
  calendar: 'Takvim',
  employee_confirm: 'Personel Onayı',
};

@Injectable()
export class HrAttendanceExportService {
  private readonly logger = new Logger(HrAttendanceExportService.name);

  constructor(
    private readonly hrService: HrService,
    private readonly systemSettings: SystemSettingsService,
    private readonly email: EmailService,
  ) {}

  async exportAttendance(
    user: AuthUser,
    year: number,
    month: number,
    format: 'xlsx' | 'print',
    res: Response,
  ): Promise<void> {
    const ctx = await this.buildExportContext(user, year, month);
    const filename = `puantaj-${year}-${String(month).padStart(2, '0')}-${this.slugify(ctx.employeeName)}`;

    if (format === 'print') {
      const html = this.buildPrintHtml(ctx);
      res.set({ 'Content-Type': 'text/html; charset=utf-8' });
      res.send(html);
      return;
    }

    const buffer = await this.buildXlsxBuffer(ctx);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}.xlsx"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  async sendToAccountant(
    user: AuthUser,
    dto: SendAttendanceAccountantDto,
  ): Promise<{ success: boolean; message: string }> {
    if (!this.isValidEmail(dto.to)) {
      throw new BadRequestException('Geçerli bir e-posta adresi girin');
    }

    const ctx = await this.buildExportContext(user, dto.year, dto.month);
    const buffer = await this.buildXlsxBuffer(ctx);
    const periodLabel = `${MONTH_LABELS[dto.month - 1]} ${dto.year}`;
    const filename = `puantaj-${dto.year}-${String(dto.month).padStart(2, '0')}-${this.slugify(ctx.employeeName)}.xlsx`;

    const summaryText = [
      `Personel: ${ctx.employeeName}`,
      `Dönem: ${periodLabel}`,
      `Onaylı Gün: ${ctx.attendance.summary.confirmedDays}`,
      `Bekleyen Onay: ${ctx.attendance.summary.pendingConfirmationDays}`,
      `Toplam Kayıtlı Süre: ${this.formatMinutes(ctx.totalMinutesWorked)}`,
    ].join('\n');

    const disclaimerHtml = DISCLAIMER_LINES.map((line) => `<li>${this.escapeHtml(line)}</li>`).join('');
    const messageBlock = dto.message?.trim()
      ? `<p><strong>Not:</strong> ${this.escapeHtml(dto.message.trim())}</p>`
      : '';

    const htmlBody = `
      <p>Merhaba,</p>
      <p>${this.escapeHtml(ctx.employeeName)} adına ${periodLabel} puantaj özeti ekte yer almaktadır.</p>
      ${messageBlock}
      <p><strong>Özet</strong></p>
      <pre style="font-family: sans-serif; white-space: pre-wrap;">${this.escapeHtml(summaryText)}</pre>
      <p><strong>Önemli Uyarılar</strong></p>
      <ul>${disclaimerHtml}</ul>
      <p style="font-size:12px;color:#64748b;">Bu e-posta Meridyen panelinden otomatik gönderilmiştir.</p>
    `;

    const result = await this.email.sendEmail(
      dto.to,
      `Puantaj — ${ctx.employeeName} — ${periodLabel}`,
      htmlBody,
      {
        text: `${ctx.employeeName} — ${periodLabel} puantaj özeti ekte.\n\n${DISCLAIMER_LINES.join('\n')}`,
        attachments: [
          {
            filename,
            content: buffer,
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          },
        ],
      },
    );
    if (!result.sent) {
      return { success: false, message: result.errorMsg || MAIL_SETUP_ERROR };
    }
    return { success: true, message: 'Puantaj mali müşavire gönderildi' };
  }

  async exportBulkAttendance(
    user: AuthUser,
    year: number,
    month: number,
    res: Response,
  ): Promise<void> {
    const ctx = await this.buildBulkExportContext(user, year, month);
    const filename = `puantaj-toplu-${year}-${String(month).padStart(2, '0')}`;
    const buffer = await this.buildBulkXlsxBuffer(ctx);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}.xlsx"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  async sendBulkToAccountant(
    user: AuthUser,
    dto: SendAttendanceAccountantDto,
  ): Promise<{ success: boolean; message: string }> {
    if (!this.isValidEmail(dto.to)) {
      throw new BadRequestException('Geçerli bir e-posta adresi girin');
    }

    const ctx = await this.buildBulkExportContext(user, dto.year, dto.month);
    const buffer = await this.buildBulkXlsxBuffer(ctx);
    const periodLabel = `${MONTH_LABELS[dto.month - 1]} ${dto.year}`;
    const filename = `puantaj-toplu-${dto.year}-${String(dto.month).padStart(2, '0')}.xlsx`;

    const summaryText = [
      `Dönem: ${periodLabel}`,
      `Personel Sayısı: ${ctx.employees.length}`,
      `Onaylı İzin Sayısı: ${ctx.leaves.length}`,
    ].join('\n');

    const disclaimerHtml = BULK_DISCLAIMER_LINES.map((line) => `<li>${this.escapeHtml(line)}</li>`).join('');
    const messageBlock = dto.message?.trim()
      ? `<p><strong>Not:</strong> ${this.escapeHtml(dto.message.trim())}</p>`
      : '';

    const htmlBody = `
      <p>Merhaba,</p>
      <p>${periodLabel} dönemi için tüm personelin elektronik onaylı puantaj özeti ve onaylı izin formları ekte yer almaktadır.</p>
      ${messageBlock}
      <p><strong>Özet</strong></p>
      <pre style="font-family: sans-serif; white-space: pre-wrap;">${this.escapeHtml(summaryText)}</pre>
      <p><strong>Önemli Uyarılar</strong></p>
      <ul>${disclaimerHtml}</ul>
      <p style="font-size:12px;color:#64748b;">Bu e-posta Meridyen panelinden otomatik gönderilmiştir.</p>
    `;

    const result = await this.email.sendEmail(
      dto.to,
      `Puantaj — Toplu — ${periodLabel}`,
      htmlBody,
      {
        text: `${periodLabel} — toplu puantaj ve izin formu özeti ekte.\n\n${BULK_DISCLAIMER_LINES.join('\n')}`,
        attachments: [
          {
            filename,
            content: buffer,
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          },
        ],
      },
    );
    if (!result.sent) {
      return { success: false, message: result.errorMsg || MAIL_SETUP_ERROR };
    }
    return { success: true, message: 'Toplu puantaj raporu mali müşavire gönderildi' };
  }

  /** Özet Ve Denetim — "Onaylamayanlara Mail Gönder" gerçek gönderim. */
  async notifyMissingAttendance(
    user: AuthUser,
  ): Promise<{ success: boolean; message: string; sentCount: number }> {
    const recipients = await this.hrService.getMissingAttendanceRecipients(user);
    if (recipients.length === 0) {
      return { success: true, message: 'Onaylamayan personel yok', sentCount: 0 };
    }

    let sentCount = 0;
    let lastError: string | undefined;

    for (const recipient of recipients) {
      if (!recipient.email || !this.isValidEmail(recipient.email)) continue;
      const result = await this.email.sendEmail(
        recipient.email,
        'Puantaj Onayı Bekliyor',
        `
            <p>Merhaba ${this.escapeHtml(recipient.fullName)},</p>
            <p>Bugünkü (${this.escapeHtml(recipient.missingDates[0] ?? '')}) puantaj onayınız henüz tamamlanmadı.
            Lütfen Personel Özlük → Puantaj sayfasından onaylayın.</p>
            <p style="font-size:12px;color:#64748b;">Bu e-posta Meridyen panelinden otomatik gönderilmiştir.</p>
          `,
        {
          text: `${recipient.fullName} — bugünkü puantaj onayınız bekliyor. Personel Özlük → Puantaj sayfasından onaylayın.`,
        },
      );
      if (result.sent) {
        sentCount += 1;
      } else {
        lastError = result.errorMsg;
        this.logger.warn(`Puantaj hatırlatma e-postası gönderilemedi (${recipient.email}): ${result.errorMsg}`);
      }
    }

    if (sentCount === 0 && lastError) {
      return { success: false, message: lastError || MAIL_SETUP_ERROR, sentCount: 0 };
    }

    return {
      success: true,
      message: `${sentCount} personele hatırlatma maili gönderildi`,
      sentCount,
    };
  }

  private async buildBulkExportContext(user: AuthUser, year: number, month: number) {
    const [profiles, leaves, companyInfo] = await Promise.all([
      this.hrService.listActiveEmployeeProfilesForPeriod(user),
      this.hrService.listApprovedLeavesForPeriod(user, year, month),
      this.systemSettings.getCompanyInfo(),
    ]);

    const employees = [];
    for (const profile of profiles) {
      const attendance = await this.hrService.getAttendanceForEmployee(user, profile.id, year, month);
      const pastDays = attendance.days.filter((d) => !d.isFuture);
      employees.push({
        profileId: profile.id,
        name: `${profile.user.firstName ?? ''} ${profile.user.lastName ?? ''}`.trim(),
        personnelNo: profile.personnelNo ?? '—',
        department: profile.department?.name ?? '—',
        days: pastDays,
        summary: attendance.summary,
        periodLock: attendance.periodLock,
      });
    }

    const leaveTypes = await this.systemSettings.getHrLeaveTypes();
    const leaveTypeLabels = new Map(leaveTypes.map((t) => [t.code, t.label]));

    return {
      employees,
      leaves,
      companyInfo,
      leaveTypeLabels,
      generatedAt: new Date(),
      periodLabel: `${MONTH_LABELS[month - 1]} ${year}`,
    };
  }

  private async buildBulkXlsxBuffer(
    ctx: Awaited<ReturnType<typeof this.buildBulkExportContext>>,
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();

    const summarySheet = workbook.addWorksheet('Özet');
    summarySheet.addRow(['Toplu Puantaj Raporu — Bilgilendirme Amaçlı']);
    for (const line of BULK_DISCLAIMER_LINES) {
      summarySheet.addRow([line]);
    }
    summarySheet.addRow([]);
    const employer = this.resolveEmployerIdentity(ctx.companyInfo);
    summarySheet.addRow(['İşyeri', employer.name]);
    summarySheet.addRow(['Adres', employer.address]);
    summarySheet.addRow(['Vergi No', employer.taxNumber]);
    summarySheet.addRow(['Ticaret Sicil No', employer.tradeRegistryNo]);
    summarySheet.addRow(['Dönem', ctx.periodLabel]);
    summarySheet.addRow(['Oluşturulma', this.formatDateTimeTr(ctx.generatedAt)]);
    summarySheet.addRow(['Personel Sayısı', ctx.employees.length]);
    summarySheet.addRow([]);
    summarySheet.addRow([
      'Personel', 'Departman', 'Personel No', 'Çalışılan Gün', 'İzinli Gün', 'Tatil Günü', 'Devamsız Gün',
      'Onaylı Gün', 'Bekleyen Gün', 'Personel Aylık Onay', 'Yönetici Ay Kilidi',
    ]);
    const summaryHeader = summarySheet.lastRow;
    if (summaryHeader) summaryHeader.font = { bold: true };
    for (const emp of ctx.employees) {
      const dayCounts = this.summarizeDayTypes(emp.days);
      summarySheet.addRow([
        emp.name,
        emp.department,
        emp.personnelNo,
        dayCounts.present + dayCounts.half_day,
        dayCounts.leave,
        dayCounts.holiday + dayCounts.weekly_rest,
        dayCounts.absent,
        emp.summary.confirmedDays,
        emp.summary.pendingConfirmationDays,
        emp.periodLock?.employeeConfirmedAt ? this.formatDateTimeTr(new Date(emp.periodLock.employeeConfirmedAt)) : '—',
        emp.periodLock?.lockedAt ? this.formatDateTimeTr(new Date(emp.periodLock.lockedAt)) : '—',
      ]);
    }
    summarySheet.columns.forEach((col) => { col.width = 18; });

    const detailSheet = workbook.addWorksheet('Puantaj Detay');
    detailSheet.addRow(['Personel', 'Tarih', 'Gün', 'Durum', 'Mesai Giriş', 'Mesai Bitiş', 'Kayıtlı Süre', 'Kaynak', 'Personel Onayı']);
    const detailHeader = detailSheet.lastRow;
    if (detailHeader) detailHeader.font = { bold: true };
    for (const emp of ctx.employees) {
      for (const day of emp.days) {
        const status =
          day.statusLabel
          ?? (day.attendanceStatus
            ? HR_ATTENDANCE_STATUS_LABELS[day.attendanceStatus as keyof typeof HR_ATTENDANCE_STATUS_LABELS]
              ?? day.attendanceStatus
            : 'Kayıt Yok');
        detailSheet.addRow([
          emp.name,
          this.formatDateTr(day.date),
          WEEKDAY_LABELS[day.weekday] ?? '',
          status,
          this.formatTimeTr(day.clockInAt),
          this.formatTimeTr(day.clockOutAt),
          this.formatMinutes(day.minutesWorked),
          day.source ? (SOURCE_LABELS[day.source] ?? day.source) : '—',
          day.employeeConfirmedAt ? 'Onaylı' : '—',
        ]);
      }
    }
    detailSheet.columns.forEach((col) => { col.width = 18; });

    const leaveSheet = workbook.addWorksheet('İzin Formları');
    leaveSheet.addRow(['Personel', 'İzin Türü', 'Başlangıç', 'Bitiş', 'Gün Sayısı', 'Açıklama', 'Onaylayan', 'Onay Tarihi']);
    const leaveHeader = leaveSheet.lastRow;
    if (leaveHeader) leaveHeader.font = { bold: true };
    if (ctx.leaves.length === 0) {
      leaveSheet.addRow(['Bu dönemde onaylı izin formu bulunmuyor.']);
    }
    for (const leave of ctx.leaves) {
      const empName = `${leave.employeeProfile.user.firstName ?? ''} ${leave.employeeProfile.user.lastName ?? ''}`.trim();
      const approverName = leave.approvedBy
        ? `${leave.approvedBy.firstName ?? ''} ${leave.approvedBy.lastName ?? ''}`.trim()
        : '—';
      leaveSheet.addRow([
        empName,
        ctx.leaveTypeLabels.get(leave.leaveType) ?? HR_LEAVE_TYPE_LABELS[leave.leaveType as HrLeaveType] ?? leave.leaveType,
        this.formatDateTr(this.dateToKey(leave.startDate)),
        this.formatDateTr(this.dateToKey(leave.endDate)),
        leave.dayCount ?? '—',
        leave.reason ?? '—',
        approverName,
        leave.approvedAt ? this.formatDateTimeTr(new Date(leave.approvedAt)) : '—',
      ]);
    }
    leaveSheet.columns.forEach((col) => { col.width = 20; });

    return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
  }

  private dateToKey(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  private async buildExportContext(user: AuthUser, year: number, month: number) {
    const [attendance, summary, companyInfo] = await Promise.all([
      this.hrService.listAttendance(user, year, month),
      this.hrService.getSummary(user),
      this.systemSettings.getCompanyInfo(),
    ]);

    const profile = summary.profile;
    const employeeName = `${profile.user.firstName} ${profile.user.lastName}`.trim();
    const pastDays = attendance.days.filter((d) => !d.isFuture);
    const totalMinutesWorked = pastDays.reduce((sum, d) => sum + (d.minutesWorked ?? 0), 0);

    return {
      attendance,
      companyInfo,
      employeeName,
      employeeEmail: profile.user.email,
      personnelNo: profile.personnelNo ?? '—',
      department: profile.department?.name ?? '—',
      generatedAt: new Date(),
      totalMinutesWorked,
      periodLabel: `${MONTH_LABELS[month - 1]} ${year}`,
    };
  }

  private async buildXlsxBuffer(ctx: Awaited<ReturnType<typeof this.buildExportContext>>): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Puantaj');

    sheet.addRow(['Puantaj Özeti — Bilgilendirme Amaçlı']);
    for (const line of DISCLAIMER_LINES) {
      sheet.addRow([line]);
    }
    sheet.addRow([]);

    const employer = this.resolveEmployerIdentity(ctx.companyInfo);
    sheet.addRow(['İşyeri', employer.name]);
    sheet.addRow(['Adres', employer.address]);
    sheet.addRow(['Vergi No', employer.taxNumber]);
    sheet.addRow(['Ticaret Sicil No', employer.tradeRegistryNo]);
    sheet.addRow([]);

    sheet.addRow(['Personel', ctx.employeeName]);
    sheet.addRow(['E-posta', ctx.employeeEmail]);
    sheet.addRow(['Personel No', ctx.personnelNo]);
    sheet.addRow(['Departman', ctx.department]);
    sheet.addRow(['Dönem', ctx.periodLabel]);
    sheet.addRow(['Oluşturulma', this.formatDateTimeTr(ctx.generatedAt)]);
    sheet.addRow([]);

    const lock = ctx.attendance.periodLock;
    if (lock?.employeeConfirmedAt) {
      sheet.addRow(['Personel Aylık Onay', this.formatDateTimeTr(new Date(lock.employeeConfirmedAt))]);
    }
    if (lock?.employeeSignature) {
      sheet.addRow(['Personel Dijital İmza', lock.employeeSignature]);
    }
    if (lock?.managerConfirmedAt) {
      sheet.addRow(['Yönetici Onay', this.formatDateTimeTr(new Date(lock.managerConfirmedAt))]);
    }
    if (lock?.managerSignature) {
      sheet.addRow(['Yönetici Dijital İmza', lock.managerSignature]);
    }
    if (lock?.lockedAt) {
      sheet.addRow(['Ay Kilidi', this.formatDateTimeTr(new Date(lock.lockedAt))]);
    }
    sheet.addRow([]);

    sheet.addRow(['Tarih', 'Gün', 'Durum', 'Mesai Giriş', 'Mesai Bitiş', 'Kayıtlı Süre', 'Önerilen Süre', 'Kaynak', 'Personel Onayı']);
    const headerRow = sheet.lastRow;
    if (headerRow) {
      headerRow.font = { bold: true };
    }

    const pastDays = ctx.attendance.days.filter((d) => !d.isFuture);
    for (const day of pastDays) {
      const status =
        day.statusLabel
        ?? (day.attendanceStatus
          ? HR_ATTENDANCE_STATUS_LABELS[day.attendanceStatus as keyof typeof HR_ATTENDANCE_STATUS_LABELS]
            ?? day.attendanceStatus
          : 'Kayıt Yok');
      sheet.addRow([
        this.formatDateTr(day.date),
        WEEKDAY_LABELS[day.weekday] ?? '',
        status,
        this.formatTimeTr(day.clockInAt),
        this.formatTimeTr(day.clockOutAt),
        this.formatMinutes(day.minutesWorked),
        this.formatMinutes(day.suggestedMinutes),
        day.source ? (SOURCE_LABELS[day.source] ?? day.source) : '—',
        day.employeeConfirmedAt ? 'Onaylı' : '—',
      ]);
    }

    sheet.addRow([]);
    sheet.addRow([
      'Özet',
      '',
      '',
      this.formatMinutes(ctx.totalMinutesWorked),
      '',
      `Onaylı Gün: ${ctx.attendance.summary.confirmedDays}`,
      `Bekleyen: ${ctx.attendance.summary.pendingConfirmationDays}`,
    ]);

    const dayCounts = this.summarizeDayTypes(pastDays);
    sheet.addRow([]);
    sheet.addRow(['Gün Tipi Dökümü']);
    sheet.addRow(['Çalışılan Gün', dayCounts.present]);
    sheet.addRow(['Yarım Gün', dayCounts.half_day]);
    sheet.addRow(['İzinli Gün', dayCounts.leave]);
    sheet.addRow(['Resmi Tatil / Hafta Tatili', dayCounts.holiday + dayCounts.weekly_rest]);
    sheet.addRow(['Devamsız Gün', dayCounts.absent]);
    if (dayCounts.none > 0) {
      sheet.addRow(['Kayıtsız Gün', dayCounts.none]);
    }

    sheet.columns.forEach((col) => {
      col.width = 18;
    });

    return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
  }

  private buildPrintHtml(ctx: Awaited<ReturnType<typeof this.buildExportContext>>): string {
    const employer = this.resolveEmployerIdentity(ctx.companyInfo);
    const companyName = employer.name?.trim() || 'Meridyen';
    const pastDays = ctx.attendance.days.filter((d) => !d.isFuture);
    const lock = ctx.attendance.periodLock;
    const dayCounts = this.summarizeDayTypes(pastDays);

    const disclaimerItems = DISCLAIMER_LINES.map((line) => `<li>${this.escapeHtml(line)}</li>`).join('');
    const rows = pastDays.map((day) => {
      const status =
        day.statusLabel
        ?? (day.attendanceStatus
          ? HR_ATTENDANCE_STATUS_LABELS[day.attendanceStatus as keyof typeof HR_ATTENDANCE_STATUS_LABELS]
            ?? day.attendanceStatus
          : 'Kayıt Yok');
      return `<tr>
        <td>${this.escapeHtml(this.formatDateTr(day.date))}</td>
        <td>${this.escapeHtml(WEEKDAY_LABELS[day.weekday] ?? '')}</td>
        <td>${this.escapeHtml(status)}</td>
        <td>${this.escapeHtml(this.formatTimeTr(day.clockInAt))}</td>
        <td>${this.escapeHtml(this.formatTimeTr(day.clockOutAt))}</td>
        <td>${this.escapeHtml(this.formatMinutes(day.minutesWorked))}</td>
        <td>${this.escapeHtml(this.formatMinutes(day.suggestedMinutes))}</td>
        <td>${this.escapeHtml(day.source ? (SOURCE_LABELS[day.source] ?? day.source) : '—')}</td>
        <td>${day.employeeConfirmedAt ? 'Onaylı' : '—'}</td>
      </tr>`;
    }).join('');

    const lockInfo = [
      lock?.employeeConfirmedAt
        ? `<div>Personel Aylık Onay: ${this.escapeHtml(this.formatDateTimeTr(new Date(lock.employeeConfirmedAt)))}</div>`
        : '',
      lock?.employeeSignature
        ? `<div>Personel Dijital İmza: ${this.escapeHtml(lock.employeeSignature)}</div>`
        : '',
      lock?.managerConfirmedAt
        ? `<div>Yönetici Onay: ${this.escapeHtml(this.formatDateTimeTr(new Date(lock.managerConfirmedAt)))}</div>`
        : '',
      lock?.managerSignature
        ? `<div>Yönetici Dijital İmza: ${this.escapeHtml(lock.managerSignature)}</div>`
        : '',
      lock?.lockedAt
        ? `<div>Ay Kilidi: ${this.escapeHtml(this.formatDateTimeTr(new Date(lock.lockedAt)))}</div>`
        : '',
    ].filter(Boolean).join('');

    return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>Puantaj — ${this.escapeHtml(ctx.employeeName)} — ${this.escapeHtml(ctx.periodLabel)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #0f172a; margin: 0; padding: 24px; background: #f8fafc; }
    .page { max-width: 210mm; margin: 0 auto; background: #fff; padding: 20mm; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
    h1 { font-size: 20px; margin: 0 0 4px; }
    .meta { font-size: 12px; color: #64748b; margin-bottom: 16px; }
    .disclaimer { border: 1px solid #fcd34d; background: #fffbeb; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; font-size: 12px; }
    .disclaimer ul { margin: 8px 0 0; padding-left: 18px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; font-size: 13px; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; }
    th { background: #f1f5f9; font-weight: 600; }
    .summary { margin-top: 16px; font-size: 13px; }
    .print-btn { margin-bottom: 16px; padding: 8px 16px; background: #1a4080; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-size: 13px; }
    @media print {
      body { background: #fff; padding: 0; }
      .page { box-shadow: none; padding: 0; max-width: none; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="page">
    <button type="button" class="print-btn no-print" onclick="window.print()">Yazdır</button>
    <h1>Puantaj — ${this.escapeHtml(ctx.periodLabel)}</h1>
    <div class="meta">${this.escapeHtml(companyName)} · Vergi No: ${this.escapeHtml(employer.taxNumber)} · Oluşturulma: ${this.escapeHtml(this.formatDateTimeTr(ctx.generatedAt))}</div>
    <div class="disclaimer">
      <strong>Önemli Uyarılar</strong>
      <ul>${disclaimerItems}</ul>
    </div>
    <div class="info-grid">
      <div><strong>İşyeri Adresi:</strong> ${this.escapeHtml(employer.address)}</div>
      <div><strong>Ticaret Sicil No:</strong> ${this.escapeHtml(employer.tradeRegistryNo)}</div>
      <div><strong>Personel:</strong> ${this.escapeHtml(ctx.employeeName)}</div>
      <div><strong>E-posta:</strong> ${this.escapeHtml(ctx.employeeEmail)}</div>
      <div><strong>Personel No:</strong> ${this.escapeHtml(String(ctx.personnelNo))}</div>
      <div><strong>Departman:</strong> ${this.escapeHtml(ctx.department)}</div>
    </div>
    ${lockInfo ? `<div class="meta">${lockInfo}</div>` : ''}
    <table>
      <thead>
        <tr>
          <th>Tarih</th><th>Gün</th><th>Durum</th><th>Mesai Giriş</th><th>Mesai Bitiş</th><th>Kayıtlı Süre</th><th>Önerilen Süre</th><th>Kaynak</th><th>Personel Onayı</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="summary">
      <strong>Özet:</strong>
      Toplam Kayıtlı Süre ${this.escapeHtml(this.formatMinutes(ctx.totalMinutesWorked))} ·
      Onaylı Gün ${ctx.attendance.summary.confirmedDays} ·
      Bekleyen Onay ${ctx.attendance.summary.pendingConfirmationDays}
    </div>
    <div class="summary">
      <strong>Gün Tipi Dökümü:</strong>
      Çalışılan ${dayCounts.present + dayCounts.half_day} ·
      İzinli ${dayCounts.leave} ·
      Resmi Tatil/Hafta Tatili ${dayCounts.holiday + dayCounts.weekly_rest} ·
      Devamsız ${dayCounts.absent}
    </div>
  </div>
</body>
</html>`;
  }

  /** İş Kanununa İlişkin Çalışma Süreleri Yönetmeliği m.9 — puantaj kayıtlarında işyeri kimliği bulunmalıdır. */
  private resolveEmployerIdentity(companyInfo: CompanyInfo) {
    const usePayroll = Boolean(companyInfo.payrollEmployerEnabled);
    const name = (usePayroll && companyInfo.payrollEmployerName) || companyInfo.name || '—';
    const address = (usePayroll && companyInfo.payrollEmployerAddress) || companyInfo.address || '—';
    const taxNumber = (usePayroll && companyInfo.payrollEmployerTaxNumber) || companyInfo.taxNumber || '—';
    const tradeRegistryNo =
      (usePayroll && companyInfo.payrollEmployerTradeRegistryNo) || companyInfo.tradeRegistryNo || '—';
    return { name, address, taxNumber, tradeRegistryNo };
  }

  /** Puantaj cetveli standardı — aylık gün tipi dökümü (çalışılan/izinli/raporlu/tatil/devamsız). */
  private summarizeDayTypes(days: Array<{ attendanceStatus?: string | null }>) {
    const counts = { present: 0, half_day: 0, leave: 0, holiday: 0, weekly_rest: 0, absent: 0, none: 0 };
    for (const day of days) {
      switch (day.attendanceStatus) {
        case 'present':
          counts.present += 1;
          break;
        case 'half_day':
          counts.half_day += 1;
          break;
        case 'leave':
          counts.leave += 1;
          break;
        case 'holiday':
          counts.holiday += 1;
          break;
        case 'weekly_rest':
          counts.weekly_rest += 1;
          break;
        case 'absent':
          counts.absent += 1;
          break;
        default:
          counts.none += 1;
      }
    }
    return counts;
  }

  private formatMinutes(minutes: number | null | undefined): string {
    if (minutes == null) return '—';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m} dk`;
    if (m === 0) return `${h} sa`;
    return `${h} sa ${m} dk`;
  }

  private formatDateTr(dateKey: string): string {
    const [y, mo, d] = dateKey.split('-').map(Number);
    return new Date(Date.UTC(y, mo - 1, d)).toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }

  private formatDateTimeTr(date: Date): string {
    return date.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
  }

  private formatTimeTr(iso: string | null | undefined): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString('tr-TR', {
      timeZone: 'Europe/Istanbul',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'personel';
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }
}
