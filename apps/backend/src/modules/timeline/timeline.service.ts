import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TimelineService {
  constructor(private prisma: PrismaService) {}

  async getTimeline(claimFileId: string) {
    const [history, waitings, notes] = await Promise.all([
      this.prisma.claimStatusHistory.findMany({
        where: { claimFileId },
        include: {
          fromStatus: { select: { id: true, code: true, name: true, color: true } },
          toStatus: { select: { id: true, code: true, name: true, color: true } },
          changedByUser: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { changedAt: 'asc' },
      }),
      this.prisma.claimFileWaiting.findMany({
        where: { claimFileId },
        include: {
          createdByUser: { select: { id: true, firstName: true, lastName: true } },
          resolvedByUser: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { startedAt: 'asc' },
      }),
      (this.prisma as any).timelineNote.findMany({
        where: { claimFileId },
        include: {
          author: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    // Merge and sort by date
    const timeline = [
      ...history.map((h: any) => ({
        type: 'transition' as const,
        date: h.changedAt,
        data: h,
      })),
      ...waitings.map((w: any) => ({
        type: 'waiting' as const,
        date: w.startedAt,
        data: w,
      })),
      ...notes.map((n: any) => ({
        type: 'note' as const,
        date: n.createdAt,
        data: n,
      })),
    ].sort((a, b) => a.date.getTime() - b.date.getTime());

    return timeline;
  }

  async getCurrentStage(claimFileId: string) {
    const claimFile = await this.prisma.claimFile.findUnique({
      where: { id: claimFileId },
      include: {
        currentStatus: true,
      },
    }) as any;

    if (!claimFile || !claimFile.currentStatus) return null;

    const latestHistory = await this.prisma.claimStatusHistory.findFirst({
      where: { claimFileId, toStatusId: claimFile.currentStatusId },
      orderBy: { changedAt: 'desc' },
    });

    const enteredAt = latestHistory?.changedAt || claimFile.createdAt;
    const elapsedMinutes = Math.floor((Date.now() - enteredAt.getTime()) / 60000);
    const maxMinutes = claimFile.currentStatus.maxDurationHours
      ? claimFile.currentStatus.maxDurationHours * 60
      : null;

    // 3-seviyeli SLA (Danışman Ek Talep #3)
    const warningPct = (claimFile.currentStatus.slaWarningPercent ?? 60) / 100;
    const criticalPct = (claimFile.currentStatus.slaCriticalPercent ?? 80) / 100;
    const escalationPct = (claimFile.currentStatus.slaEscalationPercent ?? 100) / 100;

    let slaStatus: 'ok' | 'warning' | 'critical' | 'escalation' = 'ok';
    if (maxMinutes) {
      const ratio = elapsedMinutes / maxMinutes;
      if (ratio >= escalationPct) slaStatus = 'escalation';
      else if (ratio >= criticalPct) slaStatus = 'critical';
      else if (ratio >= warningPct) slaStatus = 'warning';
    }

    // Active waitings (multi-wait)
    const activeWaitings = await this.prisma.claimFileWaiting.findMany({
      where: { claimFileId, resolvedAt: null },
      orderBy: { startedAt: 'desc' },
    });

    return {
      status: claimFile.currentStatus,
      enteredAt,
      elapsedMinutes,
      maxMinutes,
      slaStatus,
      slaThresholds: { warningPct, criticalPct, escalationPct },
      activeWaitings,
      // Ownership info (Ek Talep #1)
      currentResponsibleRole: claimFile.currentResponsibleRole,
      currentResponsibleUserId: claimFile.currentResponsibleUserId,
      pendingActionOwner: claimFile.pendingActionOwner,
      // Activity tracking (Ek Talep #2)
      lastActivityAt: claimFile.lastActivityAt,
      lastHumanActionAt: claimFile.lastHumanActionAt,
    };
  }

  async createWaiting(claimFileId: string, userId: string, reason: string, description?: string) {
    const waiting = await this.prisma.claimFileWaiting.create({
      data: {
        claimFileId,
        reason,
        description,
        createdByUserId: userId,
      },
    });

    // Update lastActivityAt
    await (this.prisma.claimFile as any).update({
      where: { id: claimFileId },
      data: { lastActivityAt: new Date(), lastHumanActionAt: new Date() },
    });

    return waiting;
  }

  async resolveWaiting(waitingId: string, userId: string) {
    const waiting = await this.prisma.claimFileWaiting.update({
      where: { id: waitingId },
      data: {
        resolvedAt: new Date(),
        resolvedByUserId: userId,
      },
    });

    // Update lastActivityAt
    await (this.prisma.claimFile as any).update({
      where: { id: waiting.claimFileId },
      data: { lastActivityAt: new Date(), lastHumanActionAt: new Date() },
    });

    return waiting;
  }

  // Ek Talep #5: İç Not Sistemi
  async createNote(claimFileId: string, authorId: string, content: string, noteType?: string) {
    const note = await (this.prisma as any).timelineNote.create({
      data: {
        claimFileId,
        authorId,
        content,
        noteType: noteType || 'general',
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Update lastActivityAt
    await (this.prisma.claimFile as any).update({
      where: { id: claimFileId },
      data: { lastActivityAt: new Date(), lastHumanActionAt: new Date() },
    });

    return note;
  }

  async getNotes(claimFileId: string) {
    return (this.prisma as any).timelineNote.findMany({
      where: { claimFileId },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Ek Talep #2: Hareketsiz dosya tespiti
  async getInactiveFiles(hoursThreshold: number = 48) {
    const thresholdDate = new Date(Date.now() - hoursThreshold * 60 * 60 * 1000);
    return (this.prisma.claimFile as any).findMany({
      where: {
        closedAt: null,
        OR: [
          { lastActivityAt: { lt: thresholdDate } },
          { lastActivityAt: null },
        ],
      },
      include: {
        currentStatus: { select: { id: true, code: true, name: true } },
      },
      orderBy: { lastActivityAt: 'asc' },
    });
  }
}
