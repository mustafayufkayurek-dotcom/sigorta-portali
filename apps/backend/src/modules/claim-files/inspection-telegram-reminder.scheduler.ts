import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { hostname } from 'os';
import { PrismaService } from '@/prisma/prisma.service';
import {
  buildInspectionTelegramDigest,
  buildInspectionTelegramPayload,
  type InspectionTelegramClaimRow,
} from './inspection-telegram-reminder.rule';
import {
  isTelegramInspectionReminderEnabled,
  isTelegramInspectionReminderOffHoursAllowed,
  sendMeridyenTelegramOpsMessage,
} from './telegram-ops-notify';
import { isWithinStaffNotifyWindow } from '@/modules/hr/hr-work-hours.helper';

/**
 * Günde 1 kez — tespit bekleyen/geciken açık dosya özeti → Sistem Alarmları grubu.
 * Dashboard amber band ile aynı sayım; kanal farkı yok (grup özeti her iki rol için ortak).
 * Mesai dışı / tatil / Pazar → gönderilmez (iş kanunu).
 */
@Injectable()
export class InspectionTelegramReminderScheduler {
  private readonly logger = new Logger(InspectionTelegramReminderScheduler.name);
  private running = false;

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 9 * * *', {
    name: 'inspection-telegram-reminder',
    timeZone: 'Europe/Istanbul',
  })
  async handleDailyDigest(): Promise<{
    sent: boolean;
    pendingCount: number;
    overdue48Count: number;
    skippedReason?: string;
    previewText?: string;
  }> {
    if (this.running) {
      return { sent: false, pendingCount: 0, overdue48Count: 0, skippedReason: 'already_running' };
    }
    this.running = true;
    try {
      return await this.runDigest();
    } finally {
      this.running = false;
    }
  }

  /** Manuel / test tetik */
  async runDigest(
    now = new Date(),
    opts?: { dryRun?: boolean },
  ): Promise<{
    sent: boolean;
    pendingCount: number;
    overdue48Count: number;
    skippedReason?: string;
    previewText?: string;
  }> {
    if (!isTelegramInspectionReminderEnabled()) {
      this.logger.debug('TELEGRAM_INSPECTION_REMINDER_ENABLED kapalı — atlandı');
      return { sent: false, pendingCount: 0, overdue48Count: 0, skippedReason: 'disabled' };
    }

    const offHoursAllowed = isTelegramInspectionReminderOffHoursAllowed();
    if (!isWithinStaffNotifyWindow(now) && !offHoursAllowed) {
      this.logger.log('Mesai dışı — personel Telegram uyarısı gönderilmedi');
      return {
        sent: false,
        pendingCount: 0,
        overdue48Count: 0,
        skippedReason: 'outside_work_hours',
      };
    }

    const openClaims = await this.prisma.claimFile.findMany({
      where: { currentStatus: { isClosedState: false } },
      select: {
        id: true,
        fileNo: true,
        createdAt: true,
        updatedAt: true,
        statusChangedAt: true,
        currentStatus: { select: { code: true } },
      },
      take: 500,
      orderBy: { updatedAt: 'desc' },
    });

    if (openClaims.length === 0) {
      return { sent: false, pendingCount: 0, overdue48Count: 0, skippedReason: 'no_open_claims' };
    }

    const ids = openClaims.map((c) => c.id);
    const [activities, notes] = await Promise.all([
      this.prisma.fileActivityLog.findMany({
        where: { claimFileId: { in: ids }, action: 'INSPECTION_DONE' },
        select: { claimFileId: true },
        distinct: ['claimFileId'],
      }),
      this.prisma.note.findMany({
        where: { claimFileId: { in: ids }, noteType: 'inspection' },
        select: { claimFileId: true },
        distinct: ['claimFileId'],
      }),
    ]);

    const doneIds = new Set<string>([
      ...activities.map((a) => a.claimFileId),
      ...notes.map((n) => n.claimFileId),
    ]);
    for (const c of openClaims) {
      if ((c.currentStatus?.code ?? '').toUpperCase() === 'INSPECTION_DONE') {
        doneIds.add(c.id);
      }
    }

    const rows: InspectionTelegramClaimRow[] = openClaims.map((c) => ({
      fileNo: c.fileNo,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      inspectionDone: doneIds.has(c.id),
    }));

    const digest = buildInspectionTelegramDigest(rows, now.getTime());
    const payload = buildInspectionTelegramPayload(digest, {
      at: now,
      host: hostname(),
    });

    if (!payload) {
      return {
        sent: false,
        pendingCount: 0,
        overdue48Count: 0,
        skippedReason: 'nothing_pending',
      };
    }

    if (opts?.dryRun) {
      this.logger.log(`DRY_RUN tespit Telegram özeti\n${payload.text}`);
      return {
        sent: false,
        pendingCount: digest.pendingCount,
        overdue48Count: digest.overdue48Count,
        skippedReason: 'dry_run',
        previewText: payload.text,
      };
    }

    const result = await sendMeridyenTelegramOpsMessage(payload.text);
    if (!result.ok) {
      this.logger.warn(`Telegram tespit özeti gönderilemedi: ${result.reason}`);
      return {
        sent: false,
        pendingCount: digest.pendingCount,
        overdue48Count: digest.overdue48Count,
        skippedReason: result.reason,
        previewText: payload.text,
      };
    }

    this.logger.log(
      `Telegram tespit özeti gönderildi · pending=${digest.pendingCount} overdue48=${digest.overdue48Count}`,
    );
    return {
      sent: true,
      pendingCount: digest.pendingCount,
      overdue48Count: digest.overdue48Count,
      previewText: payload.text,
    };
  }
}
