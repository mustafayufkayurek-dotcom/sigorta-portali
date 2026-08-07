import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import {
  CreateTaskAssignmentDto,
  FilterTaskAssignmentsDto,
  RejectTaskAssignmentDto,
  BulkApproveDto,
  AutoAssignDto,
  TaskAssignmentPriority,
  EscalationRules,
} from './dto/task-assignments.dto';

@Injectable()
export class TaskAssignmentsService {
  private readonly logger = new Logger(TaskAssignmentsService.name);

  constructor(private prisma: PrismaService) {}

  async create(dto: CreateTaskAssignmentDto) {
    return this.prisma.taskAssignment.create({
      data: {
        claimFileId: dto.claimFileId,
        assignedToId: dto.assignedToId,
        assignedById: dto.assignedById,
        priority: dto.priority ?? TaskAssignmentPriority.MEDIUM,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        timeoutHours: dto.timeoutHours ?? 4,
        autoAssigned: dto.autoAssigned ?? false,
        notes: dto.notes,
      },
      include: {
        claimFile: { select: { id: true, fileNo: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
        assignedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async findAll(filters: FilterTaskAssignmentsDto) {
    const where: Record<string, unknown> = {};
    if (filters.status) where.status = filters.status;
    if (filters.assignedToId) where.assignedToId = filters.assignedToId;
    if (filters.claimFileId) where.claimFileId = filters.claimFileId;
    if (filters.priority) where.priority = filters.priority;

    return this.prisma.taskAssignment.findMany({
      where,
      include: {
        claimFile: { select: { id: true, fileNo: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
        assignedBy: { select: { id: true, firstName: true, lastName: true } },
        notifications: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findPendingApprovals() {
    const rows = await this.prisma.taskAssignment.findMany({
      where: { status: 'PENDING_APPROVAL' },
      include: {
        claimFile: {
          select: {
            id: true,
            fileNo: true,
            approvedBudgetAmount: true,
            invoicedAmount: true,
            financialSummary: {
              select: { totalRevenue: true },
            },
          },
        },
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        assignedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        notifications: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            type: true,
            message: true,
            createdAt: true,
          },
        },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });

    const now = Date.now();
    return rows.map((a) => {
      const amount =
        a.claimFile.approvedBudgetAmount ??
        a.claimFile.invoicedAmount ??
        a.claimFile.financialSummary?.totalRevenue ??
        null;
      const timeoutAt = new Date(
        a.createdAt.getTime() + a.timeoutHours * 60 * 60 * 1000,
      ).toISOString();
      const delayMs = Math.max(0, now - a.createdAt.getTime());
      const delayHours = Math.floor(delayMs / 3_600_000);
      const requestEvents = a.notifications.filter((n) =>
        ['ASSIGNMENT', 'REMINDER', 'TIMEOUT_WARNING'].includes(n.type),
      );
      const requests =
        requestEvents.length > 0
          ? requestEvents.map((n) => ({
              id: n.id,
              type: n.type,
              message: n.message,
              at: n.createdAt.toISOString(),
            }))
          : [
              {
                id: `created-${a.id}`,
                type: 'ASSIGNMENT',
                message: 'Onay talebi oluşturuldu',
                at: a.createdAt.toISOString(),
              },
            ];

      return {
        id: a.id,
        claimFileId: a.claimFile.id,
        fileNumber: a.claimFile.fileNo,
        amount,
        priority: a.priority,
        createdAt: a.createdAt.toISOString(),
        timeoutAt,
        timeoutHours: a.timeoutHours,
        delayHours,
        delayLabel:
          delayHours < 1
            ? 'Az önce'
            : delayHours < 24
              ? `${delayHours} saat`
              : `${Math.floor(delayHours / 24)} gün`,
        assignedUserId: a.assignedTo.id,
        assignedUser: a.assignedTo,
        assignedBy: a.assignedBy,
        requestCount: requests.length,
        firstRequestedAt: requests[0]?.at ?? a.createdAt.toISOString(),
        lastRequestedAt: requests[requests.length - 1]?.at ?? a.createdAt.toISOString(),
        requests,
      };
    });
  }

  async approve(id: string) {
    const assignment = await this.prisma.taskAssignment.findUnique({ where: { id } });
    if (!assignment) throw new NotFoundException('Atama bulunamadı');
    if (assignment.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException('Sadece onay bekleyen atamalar onaylanabilir');
    }

    const updated = await this.prisma.taskAssignment.update({
      where: { id },
      data: { status: 'APPROVED', startedAt: new Date() },
    });

    await this.prisma.assignmentNotification.create({
      data: {
        taskAssignmentId: id,
        type: 'ASSIGNMENT',
        message: 'Atama onaylandı ve çalışmaya başlandı.',
      },
    });

    return updated;
  }

  async reject(id: string, dto?: RejectTaskAssignmentDto) {
    const assignment = await this.prisma.taskAssignment.findUnique({ where: { id } });
    if (!assignment) throw new NotFoundException('Atama bulunamadı');
    if (assignment.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException('Sadece onay bekleyen atamalar reddedilebilir');
    }

    const updated = await this.prisma.taskAssignment.update({
      where: { id },
      data: {
        status: 'REJECTED',
        notes: dto?.notes ?? assignment.notes,
      },
    });

    await this.prisma.assignmentNotification.create({
      data: {
        taskAssignmentId: id,
        type: 'ESCALATION',
        message: dto?.notes ? `Atama reddedildi: ${dto.notes}` : 'Atama reddedildi.',
      },
    });

    return updated;
  }

  async bulkApprove(dto: BulkApproveDto) {
    const assignments = await this.prisma.taskAssignment.findMany({
      where: { id: { in: dto.ids }, status: 'PENDING_APPROVAL' },
    });

    if (assignments.length === 0) {
      throw new BadRequestException('Onaylanabilir atama bulunamadı');
    }

    const approvedIds = assignments.map((a) => a.id);

    await this.prisma.taskAssignment.updateMany({
      where: { id: { in: approvedIds } },
      data: { status: 'APPROVED', startedAt: new Date() },
    });

    await this.prisma.assignmentNotification.createMany({
      data: approvedIds.map((taskAssignmentId) => ({
        taskAssignmentId,
        type: 'ASSIGNMENT' as const,
        message: 'Atama toplu onay ile onaylandı.',
      })),
    });

    return { approvedCount: approvedIds.length, approvedIds };
  }

  async autoAssign(dto: AutoAssignDto) {
    const rules = await this.prisma.assignmentRule.findMany({
      where: {
        isActive: true,
        ...(dto.workGroupId ? { workGroupId: dto.workGroupId } : {}),
        ...(dto.regionId ? { serviceRegionId: dto.regionId } : {}),
      },
      orderBy: { priority: 'desc' },
    });

    if (rules.length === 0) {
      throw new BadRequestException('Uygun atama kuralı bulunamadı');
    }

    const rule = rules[0];

    const assignment = await this.prisma.taskAssignment.create({
      data: {
        claimFileId: dto.claimFileId,
        assignedToId: rule.assignToUserId,
        assignedById: dto.assignedById,
        autoAssigned: true,
        status: 'PENDING_APPROVAL',
      },
      include: {
        claimFile: { select: { id: true, fileNo: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await this.prisma.assignmentNotification.create({
      data: {
        taskAssignmentId: assignment.id,
        type: 'ASSIGNMENT',
        message: `Otomatik kural ile atandı: ${rule.name}`,
      },
    });

    return assignment;
  }

  async getWorkload(userId: string) {
    const [pending, approved, inProgress, completed, total] = await Promise.all([
      this.prisma.taskAssignment.count({ where: { assignedToId: userId, status: 'PENDING_APPROVAL' } }),
      this.prisma.taskAssignment.count({ where: { assignedToId: userId, status: 'APPROVED' } }),
      this.prisma.taskAssignment.count({ where: { assignedToId: userId, status: 'IN_PROGRESS' } }),
      this.prisma.taskAssignment.count({ where: { assignedToId: userId, status: 'COMPLETED' } }),
      this.prisma.taskAssignment.count({ where: { assignedToId: userId } }),
    ]);

    const activeAssignments = await this.prisma.taskAssignment.findMany({
      where: {
        assignedToId: userId,
        status: { in: ['PENDING_APPROVAL', 'APPROVED', 'IN_PROGRESS'] },
      },
      include: {
        claimFile: { select: { id: true, fileNo: true } },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      take: 20,
    });

    return {
      userId,
      counts: { pending, approved, inProgress, completed, total },
      activeAssignments,
    };
  }

  /**
   * Ofis/saha personeli iş yükü — açık dosya atamaları + bu ay tamamlanan + onay bekleyen.
   * UI: /panel/personel-yonetimi İş Yükü kartları.
   */
  async getTeamWorkload() {
    const staffRoleCodes = ['office_staff', 'field_staff', 'OFFICE_STAFF', 'FIELD_STAFF'];
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const staff = await this.prisma.user.findMany({
      where: {
        status: 'active',
        role: { code: { in: staffRoleCodes } },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: { select: { name: true, code: true } },
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });

    if (staff.length === 0) return [];

    const staffIds = staff.map((u) => u.id);

    const [openFiles, closedThisMonth, pendingApprovals] = await Promise.all([
      this.prisma.claimFile.findMany({
        where: {
          currentStatus: { isClosedState: false },
          OR: [
            { assignedOfficeUserId: { in: staffIds } },
            { assignedFieldUserId: { in: staffIds } },
          ],
        },
        select: {
          id: true,
          fileNo: true,
          createdAt: true,
          assignedOfficeUserId: true,
          assignedFieldUserId: true,
          currentStatus: { select: { code: true, name: true } },
          customer: {
            select: { firstName: true, lastName: true, companyName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.claimFile.findMany({
        where: {
          currentStatus: { isClosedState: true },
          closedAt: { gte: monthStart },
          OR: [
            { assignedOfficeUserId: { in: staffIds } },
            { assignedFieldUserId: { in: staffIds } },
          ],
        },
        select: {
          assignedOfficeUserId: true,
          assignedFieldUserId: true,
          closedAt: true,
        },
      }),
      this.prisma.taskAssignment.groupBy({
        by: ['assignedToId'],
        where: {
          assignedToId: { in: staffIds },
          status: 'PENDING_APPROVAL',
        },
        _count: { _all: true },
      }),
    ]);

    const pendingByUser = new Map(
      pendingApprovals.map((row) => [row.assignedToId, row._count._all]),
    );

    type Acc = {
      activeCount: number;
      completedThisMonth: number;
      completedToday: number;
      assignments: Array<{
        id: string;
        fileNumber: string;
        status: string;
        customer?: {
          firstName?: string | null;
          lastName?: string | null;
          companyName?: string | null;
        };
        createdAt: string;
      }>;
    };

    const byUser = new Map<string, Acc>();
    for (const id of staffIds) {
      byUser.set(id, {
        activeCount: 0,
        completedThisMonth: 0,
        completedToday: 0,
        assignments: [],
      });
    }

    const bumpActive = (userId: string | null | undefined, file: (typeof openFiles)[0]) => {
      if (!userId) return;
      const acc = byUser.get(userId);
      if (!acc) return;
      acc.activeCount += 1;
      if (acc.assignments.length < 20) {
        acc.assignments.push({
          id: file.id,
          fileNumber: file.fileNo,
          status: file.currentStatus?.code ?? file.currentStatus?.name ?? 'open',
          customer: file.customer ?? undefined,
          createdAt: file.createdAt.toISOString(),
        });
      }
    };

    for (const file of openFiles) {
      bumpActive(file.assignedOfficeUserId, file);
      if (
        file.assignedFieldUserId &&
        file.assignedFieldUserId !== file.assignedOfficeUserId
      ) {
        bumpActive(file.assignedFieldUserId, file);
      }
    }

    for (const file of closedThisMonth) {
      const closedAt = file.closedAt ? new Date(file.closedAt) : null;
      const isToday = closedAt != null && closedAt >= todayStart;
      for (const uid of [file.assignedOfficeUserId, file.assignedFieldUserId]) {
        if (!uid) continue;
        const acc = byUser.get(uid);
        if (!acc) continue;
        acc.completedThisMonth += 1;
        if (isToday) acc.completedToday += 1;
      }
    }

    return staff.map((u) => {
      const acc = byUser.get(u.id)!;
      return {
        userId: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        role: u.role,
        activeCount: acc.activeCount,
        completedThisMonth: acc.completedThisMonth,
        completedToday: acc.completedToday,
        pendingApproval: pendingByUser.get(u.id) ?? 0,
        assignments: acc.assignments,
      };
    });
  }

  /**
   * Personel performans KPI — rapor adedi / onay / ciro / kâr.
   * Kaynak: RepairReport (createdByUserId). Migration yok.
   * Ciro = onaylı raporların totalSalesAmount toplamı.
   * Kâr = onaylı raporların grossProfit toplamı.
   */
  async getPerformanceKpis(opts?: {
    userId?: string;
    detail?: 'written' | 'approved' | 'revenue' | 'profit';
    /** week | month | year | custom — varsayılan year */
    period?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    // Performans yalnız Dosya Sorumlusu (office_staff) — saha etken değil
    const staffRoleCodes = ['office_staff', 'OFFICE_STAFF'];
    const approvedStatuses = ['approved', 'externally_approved'];

    const now = new Date();
    const period = (opts?.period || 'year').toLowerCase();
    let rangeStart: Date;
    let rangeEnd = new Date(now);
    rangeEnd.setHours(23, 59, 59, 999);
    let periodLabel = `${now.getFullYear()} Yılı`;

    if (period === 'week') {
      rangeStart = new Date(now);
      rangeStart.setDate(rangeStart.getDate() - 6);
      rangeStart.setHours(0, 0, 0, 0);
      periodLabel = 'Son 7 Gün';
    } else if (period === 'month') {
      rangeStart = new Date(now.getFullYear(), now.getMonth(), 1);
      rangeStart.setHours(0, 0, 0, 0);
      periodLabel = now.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
      periodLabel = periodLabel.charAt(0).toLocaleUpperCase('tr-TR') + periodLabel.slice(1);
    } else if (period === 'custom' && opts?.dateFrom && opts?.dateTo) {
      rangeStart = new Date(`${opts.dateFrom}T00:00:00`);
      rangeEnd = new Date(`${opts.dateTo}T23:59:59.999`);
      if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime())) {
        rangeStart = new Date(now.getFullYear(), 0, 1);
        periodLabel = `${now.getFullYear()} Yılı`;
      } else {
        periodLabel = `${opts.dateFrom} – ${opts.dateTo}`;
      }
    } else {
      rangeStart = new Date(now.getFullYear(), 0, 1);
      rangeStart.setHours(0, 0, 0, 0);
    }

    const staff = await this.prisma.user.findMany({
      where: {
        status: 'active',
        role: { code: { in: staffRoleCodes } },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: { select: { name: true, code: true } },
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });

    const staffOptions = staff.map((u) => ({
      userId: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      roleLabel: u.role?.name ?? 'Dosya Sorumlusu',
    }));

    const staffIds = staff.map((u) => u.id);
    const filterUserId =
      opts?.userId && staffIds.includes(opts.userId) ? opts.userId : undefined;

    const reportWhere = {
      createdAt: { gte: rangeStart, lte: rangeEnd },
      createdByUserId: filterUserId
        ? filterUserId
        : { in: staffIds.length ? staffIds : ['__none__'] },
      status: { not: 'cancelled' },
    };

    const reports = staffIds.length
      ? await this.prisma.repairReport.findMany({
          where: reportWhere,
          select: {
            id: true,
            reportNo: true,
            status: true,
            totalSalesAmount: true,
            totalSupplierCost: true,
            grossProfit: true,
            reportDate: true,
            createdAt: true,
            createdByUserId: true,
            claimFileId: true,
            claimFile: { select: { id: true, fileNo: true } },
            createdBy: { select: { firstName: true, lastName: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 2000,
        })
      : [];

    const statusLabel = (status: string) => {
      switch (status) {
        case 'draft':
          return 'Taslak';
        case 'pending_approval':
        case 'pending':
          return 'Onay Bekliyor';
        case 'approved':
          return 'Onaylandı';
        case 'externally_approved':
          return 'Harici Onay';
        case 'rejected':
        case 'externally_rejected':
          return 'Reddedildi';
        default:
          return status;
      }
    };

    const rows = reports.map((r) => ({
      reportId: r.id,
      reportNo: r.reportNo,
      claimFileId: r.claimFileId,
      fileNo: r.claimFile?.fileNo ?? '—',
      status: r.status,
      statusLabel: statusLabel(r.status),
      salesAmount: Number(r.totalSalesAmount ?? 0),
      supplierCost: Number(r.totalSupplierCost ?? 0),
      profitAmount: Number(r.grossProfit ?? 0),
      reportDate: r.reportDate?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      authorName: `${r.createdBy?.firstName ?? ''} ${r.createdBy?.lastName ?? ''}`.trim(),
      isApproved: approvedStatuses.includes(r.status),
    }));

    const approvedRows = rows.filter((r) => r.isApproved);
    const kpis = {
      reportsWritten: rows.length,
      reportsApproved: approvedRows.length,
      revenue: approvedRows.reduce((s, r) => s + r.salesAmount, 0),
      profit: approvedRows.reduce((s, r) => s + r.profitAmount, 0),
    };

    const selected = filterUserId
      ? staffOptions.find((s) => s.userId === filterUserId) ?? null
      : null;

    let details:
      | {
          kind: 'written' | 'approved' | 'revenue' | 'profit';
          title: string;
          rows: typeof rows;
        }
      | undefined;

    if (opts?.detail) {
      const kind = opts.detail;
      if (kind === 'written') {
        details = { kind, title: 'Yazılan Raporlar', rows };
      } else if (kind === 'approved') {
        details = { kind, title: 'Onaylanan Raporlar', rows: approvedRows };
      } else if (kind === 'revenue') {
        details = {
          kind,
          title: 'Ciro Detayı (Onaylı Raporlar)',
          rows: approvedRows.filter((r) => r.salesAmount > 0),
        };
      } else {
        details = {
          kind,
          title: 'Kâr Detayı (Onaylı Raporlar)',
          rows: approvedRows.filter((r) => r.profitAmount !== 0),
        };
      }
    }

    return {
      scope: filterUserId ? ('user' as const) : ('all' as const),
      userId: filterUserId ?? null,
      userName: selected
        ? `${selected.firstName} ${selected.lastName}`.trim()
        : null,
      roleLabel: selected?.roleLabel ?? null,
      period,
      periodLabel,
      kpis,
      staffOptions,
      details,
    };
  }

  @Cron('0 */30 * * * *')
  async checkTimeouts() {
    const now = new Date();

    const timedOutAssignments = await this.prisma.taskAssignment.findMany({
      where: {
        status: 'PENDING_APPROVAL',
        createdAt: {
          lte: new Date(now.getTime() - 0),
        },
      },
    });

    const truly_timedOut = timedOutAssignments.filter((a) => {
      const timeoutMs = a.timeoutHours * 60 * 60 * 1000;
      return now.getTime() - a.createdAt.getTime() >= timeoutMs;
    });

    if (truly_timedOut.length === 0) return;

    const ids = truly_timedOut.map((a) => a.id);

    await this.prisma.taskAssignment.updateMany({
      where: { id: { in: ids } },
      data: { status: 'TIMEOUT_AUTO_ASSIGNED', startedAt: new Date() },
    });

    await this.prisma.assignmentNotification.createMany({
      data: ids.map((taskAssignmentId) => ({
        taskAssignmentId,
        type: 'TIMEOUT_WARNING' as const,
        message: 'Onay süresi geçti. Atama otomatik olarak onaylandı.',
      })),
    });

    return { processedCount: ids.length };
  }

  // ─── Eskalasyon Kuralları ─────────────────────────────────────────────────

  async getEscalationRules(): Promise<EscalationRules> {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: 'escalation_rules' },
    });
    if (setting && setting.value) {
      return setting.value as unknown as EscalationRules;
    }
    return { warningDays: 3, criticalDays: 7, escalationDays: 14 };
  }

  async setEscalationRules(rules: EscalationRules): Promise<EscalationRules> {
    await this.prisma.systemSetting.upsert({
      where: { key: 'escalation_rules' },
      update: { value: rules as any },
      create: { key: 'escalation_rules', value: rules as any },
    });
    return rules;
  }

  // ─── Günlük Eskalasyon Kontrol Cron (09:00) ───────────────────────────────

  @Cron('0 0 9 * * *')
  async checkEscalations() {
    this.logger.log('Günlük eskalasyon kontrolü çalıştırılıyor...');
    const rules = await this.getEscalationRules();
    const now = new Date();

    const warningThreshold = new Date(now.getTime() - rules.warningDays * 24 * 60 * 60 * 1000);
    const criticalThreshold = new Date(now.getTime() - rules.criticalDays * 24 * 60 * 60 * 1000);
    const escalationThreshold = new Date(now.getTime() - rules.escalationDays * 24 * 60 * 60 * 1000);

    const inProgressAssignments = await this.prisma.taskAssignment.findMany({
      where: {
        status: { in: ['IN_PROGRESS', 'APPROVED', 'PENDING_APPROVAL'] },
      },
      include: {
        claimFile: { select: { id: true, fileNo: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    const notificationsToCreate: Array<{
      taskAssignmentId: string;
      type: 'REMINDER' | 'OVERDUE' | 'ESCALATION';
      message: string;
    }> = [];

    for (const assignment of inProgressAssignments) {
      const lastUpdate = assignment.updatedAt;
      const fileNo = assignment.claimFile?.fileNo ?? assignment.id;
      const personName = assignment.assignedTo
        ? `${assignment.assignedTo.firstName} ${assignment.assignedTo.lastName}`
        : 'Bilinmeyen';

      if (lastUpdate <= escalationThreshold) {
        // Daha önce bu gün için ESCALATION bildirim oluşturduk mu kontrol et
        const existing = await this.prisma.assignmentNotification.findFirst({
          where: {
            taskAssignmentId: assignment.id,
            type: 'ESCALATION',
            createdAt: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) },
          },
        });
        if (!existing) {
          const daysDiff = Math.floor((now.getTime() - lastUpdate.getTime()) / (24 * 60 * 60 * 1000));
          notificationsToCreate.push({
            taskAssignmentId: assignment.id,
            type: 'ESCALATION',
            message: `ESKALASYon: ${fileNo} dosyası ${daysDiff} gündür (${personName}) tarafından güncellenmedi. Üst yöneticiye iletildi.`,
          });
        }
      } else if (lastUpdate <= criticalThreshold) {
        const existing = await this.prisma.assignmentNotification.findFirst({
          where: {
            taskAssignmentId: assignment.id,
            type: 'OVERDUE',
            createdAt: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) },
          },
        });
        if (!existing) {
          const daysDiff = Math.floor((now.getTime() - lastUpdate.getTime()) / (24 * 60 * 60 * 1000));
          notificationsToCreate.push({
            taskAssignmentId: assignment.id,
            type: 'OVERDUE',
            message: `KRİTİK: ${fileNo} dosyası ${daysDiff} gündür (${personName}) tarafından güncellenmedi. Yöneticiye bildirildi.`,
          });
        }
      } else if (lastUpdate <= warningThreshold) {
        const existing = await this.prisma.assignmentNotification.findFirst({
          where: {
            taskAssignmentId: assignment.id,
            type: 'REMINDER',
            createdAt: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) },
          },
        });
        if (!existing) {
          const daysDiff = Math.floor((now.getTime() - lastUpdate.getTime()) / (24 * 60 * 60 * 1000));
          notificationsToCreate.push({
            taskAssignmentId: assignment.id,
            type: 'REMINDER',
            message: `UYARI: ${fileNo} dosyası ${daysDiff} gündür güncellenmedi. Lütfen ilerleme kaydedin.`,
          });
        }
      }
    }

    if (notificationsToCreate.length > 0) {
      await this.prisma.assignmentNotification.createMany({
        data: notificationsToCreate,
      });
      this.logger.log(`${notificationsToCreate.length} eskalasyon bildirimi oluşturuldu.`);
    }

    return { processedCount: notificationsToCreate.length };
  }

  // ─── Geciken Dosyalar ─────────────────────────────────────────────────────

  async getOverdueAssignments() {
    const rules = await this.getEscalationRules();
    const now = new Date();

    const warningThreshold = new Date(now.getTime() - rules.warningDays * 24 * 60 * 60 * 1000);

    const assignments = await this.prisma.taskAssignment.findMany({
      where: {
        status: { in: ['IN_PROGRESS', 'APPROVED', 'PENDING_APPROVAL'] },
        updatedAt: { lte: warningThreshold },
      },
      include: {
        claimFile: { select: { id: true, fileNo: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { updatedAt: 'asc' },
    });

    const criticalThreshold = new Date(now.getTime() - rules.criticalDays * 24 * 60 * 60 * 1000);
    const escalationThreshold = new Date(now.getTime() - rules.escalationDays * 24 * 60 * 60 * 1000);

    return assignments.map((a) => {
      const daysDiff = Math.floor((now.getTime() - a.updatedAt.getTime()) / (24 * 60 * 60 * 1000));
      let level: 'warning' | 'critical' | 'escalation' = 'warning';
      if (a.updatedAt <= escalationThreshold) level = 'escalation';
      else if (a.updatedAt <= criticalThreshold) level = 'critical';

      return {
        ...a,
        daysSinceUpdate: daysDiff,
        escalationLevel: level,
      };
    });
  }

  // ─── Bildirim Metodları ───────────────────────────────────────────────────

  async getNotifications(userId: string, limit = 20) {
    const userAssignments = await this.prisma.taskAssignment.findMany({
      where: { assignedToId: userId },
      select: { id: true },
    });
    const assignmentIds = userAssignments.map((a) => a.id);

    return this.prisma.assignmentNotification.findMany({
      where: { taskAssignmentId: { in: assignmentIds } },
      include: {
        taskAssignment: {
          select: {
            id: true,
            claimFile: { select: { id: true, fileNo: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getUnreadCount(userId: string) {
    const userAssignments = await this.prisma.taskAssignment.findMany({
      where: { assignedToId: userId },
      select: { id: true },
    });
    const assignmentIds = userAssignments.map((a) => a.id);

    const count = await this.prisma.assignmentNotification.count({
      where: {
        taskAssignmentId: { in: assignmentIds },
        isRead: false,
      },
    });

    return { count };
  }

  async markNotificationRead(notificationId: string) {
    const notification = await this.prisma.assignmentNotification.findUnique({
      where: { id: notificationId },
    });
    if (!notification) throw new NotFoundException('Bildirim bulunamadı');

    return this.prisma.assignmentNotification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }

  async markAllNotificationsRead(userId: string) {
    const userAssignments = await this.prisma.taskAssignment.findMany({
      where: { assignedToId: userId },
      select: { id: true },
    });
    const assignmentIds = userAssignments.map((a) => a.id);

    const result = await this.prisma.assignmentNotification.updateMany({
      where: {
        taskAssignmentId: { in: assignmentIds },
        isRead: false,
      },
      data: { isRead: true },
    });

    return { updatedCount: result.count };
  }
}
