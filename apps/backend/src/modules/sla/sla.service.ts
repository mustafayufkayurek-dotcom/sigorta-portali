import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateSlaRuleDto, UpdateSlaRuleDto } from './dto/sla-rule.dto';
import { ClaimEventEmailService } from '@/modules/notifications/email/claim-event-email.service';

@Injectable()
export class SlaService {
  private readonly logger = new Logger(SlaService.name);

  constructor(
    private prisma: PrismaService,
    @Optional() private readonly claimEventEmail?: ClaimEventEmailService,
  ) {}

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async findAllRules() {
    return this.prisma.slaRule.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async createRule(dto: CreateSlaRuleDto) {
    return this.prisma.slaRule.create({ data: dto });
  }

  async updateRule(id: string, dto: UpdateSlaRuleDto) {
    return this.prisma.slaRule.update({ where: { id }, data: dto });
  }

  async deleteRule(id: string) {
    return this.prisma.slaRule.delete({ where: { id } });
  }

  // ── SLA Report ────────────────────────────────────────────────────────────

  async getSlaReport(filters: {
    dateFrom?: string;
    dateTo?: string;
    insuranceCompanyId?: string;
    productBranch?: string;
  }) {
    const now = new Date();

    const where: any = { currentStatus: { isClosedState: false } };
    if (filters.dateFrom || filters.dateTo) {
      where.notificationDate = {};
      if (filters.dateFrom) where.notificationDate.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.notificationDate.lte = new Date(filters.dateTo);
    }
    if (filters.insuranceCompanyId) where.insuranceCompanyId = filters.insuranceCompanyId;
    if (filters.productBranch) where.productBranch = filters.productBranch;

    const openFiles = await this.prisma.claimFile.findMany({
      where,
      include: {
        currentStatus: { select: { name: true, isClosedState: true } },
        insuranceCompany: { select: { id: true, name: true } },
        assignedOfficeUser: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    const rules = await this.prisma.slaRule.findMany({ where: { isActive: true } });

    const overdueFiles: Array<{
      id: string;
      fileNo: string;
      claimNo: string;
      productBranch: string | null;
      status: string;
      notificationDate: Date;
      slaDueAt: Date | null;
      daysOverdue: number;
      insuranceCompany: string | null;
      officeUser: string | null;
    }> = [];

    let violated = 0;

    const insMap = new Map<string, { name: string; total: number; violated: number }>();
    const branchMap = new Map<string, { total: number; violated: number }>();

    // Monthly violation trend (last 6 months)
    const trendMap = new Map<string, { total: number; violated: number }>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      trendMap.set(d.toISOString().substring(0, 7), { total: 0, violated: 0 });
    }

    for (const file of openFiles) {
      // Find matching rule
      const rule =
        rules.find(
          (r) =>
            (!r.productBranch || r.productBranch === file.productBranch) &&
            (!r.claimType || r.claimType === file.lossType),
        ) ?? rules.find((r) => !r.productBranch && !r.claimType);

      const slaDueAt = rule
        ? new Date(file.notificationDate.getTime() + rule.targetDays * 86400000)
        : file.slaDueAt;

      const isViolated = !!(slaDueAt && slaDueAt < now);
      const daysOverdue = isViolated
        ? Math.floor((now.getTime() - slaDueAt!.getTime()) / 86400000)
        : 0;

      if (isViolated) {
        violated++;
        overdueFiles.push({
          id: file.id,
          fileNo: file.fileNo,
          claimNo: file.claimNo,
          productBranch: file.productBranch,
          status: file.currentStatus.name,
          notificationDate: file.notificationDate,
          slaDueAt,
          daysOverdue,
          insuranceCompany: file.insuranceCompany?.name ?? null,
          officeUser: file.assignedOfficeUser
            ? `${file.assignedOfficeUser.firstName} ${file.assignedOfficeUser.lastName}`
            : null,
        });
      }

      // By insurance
      if (file.insuranceCompany) {
        const key = file.insuranceCompany.id;
        if (!insMap.has(key))
          insMap.set(key, { name: file.insuranceCompany.name, total: 0, violated: 0 });
        const ins = insMap.get(key)!;
        ins.total++;
        if (isViolated) ins.violated++;
      }

      // By branch
      const branch = file.productBranch ?? 'Diğer';
      if (!branchMap.has(branch)) branchMap.set(branch, { total: 0, violated: 0 });
      const br = branchMap.get(branch)!;
      br.total++;
      if (isViolated) br.violated++;

      // Trend
      const monthKey = file.notificationDate.toISOString().substring(0, 7);
      if (trendMap.has(monthKey)) {
        const t = trendMap.get(monthKey)!;
        t.total++;
        if (isViolated) t.violated++;
      }
    }

    const totalOpen = openFiles.length;
    const violationRate = totalOpen > 0 ? Math.round((violated / totalOpen) * 10000) / 100 : 0;

    return {
      summary: { totalOpen, violated, violationRate },
      trend: Array.from(trendMap.entries()).map(([month, v]) => ({
        month,
        total: v.total,
        violated: v.violated,
        rate: v.total > 0 ? Math.round((v.violated / v.total) * 10000) / 100 : 0,
      })),
      byInsurance: Array.from(insMap.values())
        .map((v) => ({
          ...v,
          violationRate: v.total > 0 ? Math.round((v.violated / v.total) * 10000) / 100 : 0,
        }))
        .sort((a, b) => b.violated - a.violated),
      byBranch: Array.from(branchMap.entries())
        .map(([branch, v]) => ({
          branch,
          ...v,
          violationRate: v.total > 0 ? Math.round((v.violated / v.total) * 10000) / 100 : 0,
        }))
        .sort((a, b) => b.violated - a.violated),
      overdueFiles: overdueFiles.sort((a, b) => b.daysOverdue - a.daysOverdue),
    };
  }

  // ── Cron: Daily SLA Violation Check ───────────────────────────────────────

  async checkViolations() {
    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    this.logger.log('SLA ihlal kontrolü başlatıldı');

    const openFiles = await this.prisma.claimFile.findMany({
      where: { currentStatus: { isClosedState: false } },
      include: {
        currentStatus: { select: { isClosedState: true } },
        assignedOfficeUser: { select: { id: true, email: true } },
      },
    });

    const rules = await this.prisma.slaRule.findMany({ where: { isActive: true } });
    const milestones = [1, 3, 7, 14];

    let notified = 0;
    for (const file of openFiles) {
      const rule =
        rules.find(
          (r) =>
            (!r.productBranch || r.productBranch === file.productBranch) &&
            (!r.claimType || r.claimType === file.lossType),
        ) ?? rules.find((r) => !r.productBranch && !r.claimType);

      const slaDueAt = rule
        ? new Date(file.notificationDate.getTime() + rule.targetDays * 86400000)
        : file.slaDueAt;

      if (!slaDueAt || slaDueAt >= now) continue;

      const daysOverdue = Math.floor((now.getTime() - slaDueAt.getTime()) / 86400000);
      if (!milestones.includes(daysOverdue)) continue;

      const targetUserId = file.assignedOfficeUserId ?? null;
      if (!targetUserId) continue;

      // Deduplication: skip if already notified today for same file+user
      const existing = await this.prisma.notification.findFirst({
        where: {
          userId: targetUserId,
          relatedEntityType: 'claim_file',
          relatedEntityId: file.id,
          type: 'sla_violation',
          createdAt: { gte: today },
        },
      });
      if (existing) continue;

      const severity =
        daysOverdue >= 14
          ? 'critical'
          : daysOverdue >= 7
            ? 'high'
            : daysOverdue >= 3
              ? 'warning'
              : 'info';

      await this.prisma.notification.create({
        data: {
          userId: targetUserId,
          type: 'sla_violation',
          title: `SLA İhlali — ${daysOverdue} Gün (${severity})`,
          body: `${file.fileNo} numaralı dosya SLA süresini ${daysOverdue} gün aştı.`,
          channel: 'in_app',
          relatedEntityType: 'claim_file',
          relatedEntityId: file.id,
          status: 'pending',
        },
      });

      // Email bildirimi
      const officeUser = file.assignedOfficeUser as any;
      if (this.claimEventEmail && officeUser?.email) {
        void this.claimEventEmail.onSlaViolation({
          recipientEmail: officeUser.email,
          recipientUserId: targetUserId,
          fileNo: file.fileNo,
          daysOverdue,
          slaDueAt: slaDueAt.toLocaleDateString('tr-TR'),
          claimFileId: file.id,
        });
      }

      notified++;
    }

    this.logger.log(`SLA ihlal kontrolü tamamlandı. ${notified} bildirim gönderildi.`);
  }
}
