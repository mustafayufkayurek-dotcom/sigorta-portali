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
    return this.prisma.taskAssignment.findMany({
      where: { status: 'PENDING_APPROVAL' },
      include: {
        claimFile: { select: { id: true, fileNo: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
        assignedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
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
