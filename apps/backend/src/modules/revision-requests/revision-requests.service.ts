import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Optional,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@/prisma/prisma.service';
import { ClaimEventEmailService } from '@/modules/notifications/email/claim-event-email.service';
import {
  applyClaimFileListScope,
  assertClaimFileAccess,
  normalizeRequestUser,
} from '@/common/helpers/claim-file-scope.helper';

const CLAIM_FILE_ACCESS_DENIED = 'Bu dosyaya erişim izniniz bulunmamaktadır';
const CLAIM_FILE_ACCESS_SELECT = {
  insuranceCompanyId: true,
  assignedFieldUserId: true,
  closedAt: true,
  customerId: true,
  assignedAdjusterId: true,
  sourceChannel: true,
} as const;

function requireRequestUser(user: any) {
  const normalized = normalizeRequestUser(user);
  if (!normalized) {
    throw new ForbiddenException(CLAIM_FILE_ACCESS_DENIED);
  }
  return normalized;
}

function assertClaimFileAccessForRequest(claimFile: any, user: any) {
  const requestingUser = requireRequestUser(user);
  assertClaimFileAccess(claimFile, requestingUser);
}
import { buildRevisionListWhere } from './revision-requests.scope';
import {
  CreateRevisionRequestDto,
  UpdateRevisionStatusDto,
  ListRevisionRequestsDto,
  CreateRevisionMessageDto,
  StartRevisionDto,
  CompleteRevisionDto,
  RevisionStatus,
} from './dto/revision-requests.dto';
import {
  REPAIR_REPORT_INITIAL_VERSION,
  REPAIR_REPORT_MAX_REVISION_MESSAGE,
  canCreateRepairReportRevision,
  nextRepairReportVersionNo,
} from '@sigorta/shared';

@Injectable()
export class RevisionRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly claimEventEmail?: ClaimEventEmailService,
  ) {}

  // ── Revizyon Talebi Oluştur ──────────────────────────────────────────────

  async create(requestedById: string, dto: CreateRevisionRequestDto, user?: unknown) {
    const report = await this.prisma.repairReport.findUnique({
      where: { id: dto.reportId },
      include: {
        claimFile: { select: { id: true, fileNo: true, ...CLAIM_FILE_ACCESS_SELECT } },
      },
    });
    if (!report) {
      throw new NotFoundException('Rapor bulunamadı');
    }
    this.assertReportClaimAccess(report.claimFile, user);

    const revisionRequest = await this.prisma.reportRevisionRequest.create({
      data: {
        reportId: dto.reportId,
        requestedById,
        assignedToId: dto.assignedToId,
        priority: dto.priority,
        reason: dto.reason,
        reasonNote: dto.reasonNote,
        affectedItems: dto.affectedItems ?? [],
        deadlineAt: dto.deadlineAt ? new Date(dto.deadlineAt) : null,
      },
      include: {
        report: { select: { id: true, reportNo: true, status: true } },
        requestedBy: { select: { id: true, firstName: true, lastName: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    // Email: Atanan personele revizyon bildirimi
    if (this.claimEventEmail && dto.assignedToId) {
      const assignedTo = revisionRequest.assignedTo as any;
      if (assignedTo?.email) {
        void this.claimEventEmail.onRevisionRequest({
          recipientEmail: assignedTo.email,
          recipientUserId: dto.assignedToId,
          reportNo: (revisionRequest.report as any).reportNo,
          fileNo: (report.claimFile as any)?.fileNo ?? '',
          reason: `${dto.reason}: ${dto.reasonNote}`,
          deadline: dto.deadlineAt ?? undefined,
          claimFileId: report.claimFileId,
          revisionId: revisionRequest.id,
        });
      }
    }

    return revisionRequest;
  }

  // ── Talepleri Listele ────────────────────────────────────────────────────

  async findAll(query: ListRevisionRequestsDto, user?: unknown) {
    const requestingUser = requireRequestUser(user);
    const where = buildRevisionListWhere(query, requestingUser);
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(200, Math.max(1, Number(query.limit ?? 50)));

    const [data, total] = await Promise.all([
      this.prisma.reportRevisionRequest.findMany({
        where,
        include: {
          report: { select: { id: true, claimFileId: true, reportNo: true, status: true } },
          requestedBy: { select: { id: true, firstName: true, lastName: true } },
          assignedTo: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { messages: true } },
        },
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'desc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.reportRevisionRequest.count({ where }),
    ]);

    return {
      data: data.map((item) => ({
        ...item,
        claimFileId: item.report?.claimFileId ?? null,
      })),
      meta: { total, page, limit },
    };
  }

  // ── Talep Detayı ─────────────────────────────────────────────────────────

  async findOne(id: string, user?: unknown) {
    await this.assertRevisionClaimAccess(id, user);
    const data = await this.prisma.reportRevisionRequest.findUnique({
      where: { id },
      include: {
        report: {
          select: {
            id: true,
            reportNo: true,
            status: true,
            versionNo: true,
            totalSalesAmount: true,
          },
        },
        requestedBy: { select: { id: true, firstName: true, lastName: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        newReport: { select: { id: true, reportNo: true, status: true, versionNo: true } },
        messages: {
          include: {
            sender: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!data) throw new NotFoundException('Revizyon talebi bulunamadı');
    return { data };
  }

  // ── Durum Güncelle ───────────────────────────────────────────────────────

  async updateStatus(id: string, dto: UpdateRevisionStatusDto, user?: unknown) {
    await this.assertRevisionClaimAccess(id, user);
    const revisionRequest = await this.prisma.reportRevisionRequest.findUnique({
      where: { id },
    });
    if (!revisionRequest) {
      throw new NotFoundException('Revizyon talebi bulunamadı');
    }

    const validTransitions: Record<string, string[]> = {
      REQUESTED: ['IN_PROGRESS', 'REJECTED'],
      IN_PROGRESS: ['COMPLETED', 'REJECTED'],
      ESCALATED: ['IN_PROGRESS', 'REJECTED'],
    };

    const allowed = validTransitions[revisionRequest.status] ?? [];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `${revisionRequest.status} durumundan ${dto.status} durumuna geçiş yapılamaz`,
      );
    }

    const updateData: Record<string, unknown> = {
      status: dto.status,
    };
    if (dto.responseNote) updateData.responseNote = dto.responseNote;
    if (dto.newReportId) updateData.newReportId = dto.newReportId;
    if (dto.status === 'COMPLETED') updateData.completedAt = new Date();

    const data = await this.prisma.reportRevisionRequest.update({
      where: { id },
      data: updateData,
      include: {
        report: { select: { id: true, reportNo: true, status: true } },
        requestedBy: { select: { id: true, firstName: true, lastName: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return { data };
  }

  // ── Revizyonu Başlat ─────────────────────────────────────────────────────

  async startRevision(id: string, userId: string, dto: StartRevisionDto, user?: unknown) {
    await this.assertRevisionClaimAccess(id, user);
    const revisionRequest = await this.prisma.reportRevisionRequest.findUnique({
      where: { id },
      include: { report: true },
    });
    if (!revisionRequest) {
      throw new NotFoundException('Revizyon talebi bulunamadı');
    }
    if (revisionRequest.status !== 'REQUESTED' && revisionRequest.status !== 'ESCALATED') {
      throw new BadRequestException('Yalnızca REQUESTED veya ESCALATED durumundaki talepler başlatılabilir');
    }

    // RepairReportsService.reviseReport çağrısı yerine doğrudan Prisma ile kopyalama
    const report = await this.prisma.repairReport.findUnique({
      where: { id: revisionRequest.reportId },
      include: {
        items: { include: { damageType: true } },
        images: true,
        damageTypes: true,
      },
    });
    if (!report) throw new NotFoundException('Rapor bulunamadı');

    if (
      report.status !== 'approved' &&
      report.status !== 'externally_approved' &&
      report.status !== 'externally_rejected'
    ) {
      throw new BadRequestException('Yalnızca onaylanmış raporlar revize edilebilir');
    }

    const originalId = report.originalReportId ?? report.id;

    const existingDraft = await this.prisma.repairReport.findFirst({
      where: {
        originalReportId: originalId,
        status: { in: ['draft', 'rejected', 'pending_approval'] },
      },
    });
    if (existingDraft) {
      throw new BadRequestException('Bu rapor için zaten açık bir revizyon mevcut');
    }

    const allVersions = await this.prisma.repairReport.findMany({
      where: {
        OR: [{ id: originalId }, { originalReportId: originalId }],
      },
      select: { versionNo: true },
    });
    const maxVersion = allVersions.reduce(
      (max, v) => Math.max(max, v.versionNo),
      REPAIR_REPORT_INITIAL_VERSION,
    );
    if (!canCreateRepairReportRevision(maxVersion)) {
      throw new BadRequestException(REPAIR_REPORT_MAX_REVISION_MESSAGE);
    }
    const newVersionNo = nextRepairReportVersionNo(maxVersion)!;

    const baseReportNo = report.reportNo.replace(/-R\d+$/, '');
    const newReportNo = `${baseReportNo}-R${newVersionNo}`;

    const result = await this.prisma.$transaction(async (tx) => {
      const newReport = await tx.repairReport.create({
        data: {
          claimFileId: report.claimFileId,
          reportNo: newReportNo,
          reportType: report.reportType,
          reportDate: new Date(),
          inspectorName: report.inspectorName,
          reporterName: report.reporterName,
          findingsText: report.findingsText,
          legalNotes: report.legalNotes,
          status: 'draft',
          departmentId: report.departmentId,
          expertOfficeId: report.expertOfficeId,
          createdByUserId: userId,
          versionNo: newVersionNo,
          originalReportId: originalId,
          revisedByUserId: userId,
          revisedAt: new Date(),
        },
      });

      if (report.damageTypes.length > 0) {
        await tx.reportDamageType.createMany({
          data: report.damageTypes.map((dt) => ({
            reportId: newReport.id,
            damageTypeCode: dt.damageTypeCode,
            damageTypeName: dt.damageTypeName,
            sortOrder: dt.sortOrder,
          })),
        });
      }

      if (report.items.length > 0) {
        await tx.repairReportItem.createMany({
          data: report.items.map((item) => ({
            reportId: newReport.id,
            workGroupId: item.workGroupId,
            location: item.location,
            jobDescription: item.jobDescription,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            supplierUnitPrice: item.supplierUnitPrice,
            salesUnitPrice: item.salesUnitPrice,
            supplierTotal: item.supplierTotal,
            salesTotal: item.salesTotal,
            marginPct: item.marginPct,
            sortOrder: item.sortOrder,
            metrajData: item.metrajData ?? undefined,
            pricingType: item.pricingType,
            lumpSumPrice: item.lumpSumPrice,
            materialIncluded: item.materialIncluded,
            laborIncluded: item.laborIncluded,
            damageCategory: item.damageCategory,
          })),
        });
      }

      await tx.repairReport.update({
        where: { id: originalId },
        data: { revisionCount: { increment: 1 } },
      });

      const updateData: Record<string, unknown> = {
        status: 'IN_PROGRESS',
        newReportId: newReport.id,
        assignedToId: userId,
      };
      if (dto.responseNote) updateData.responseNote = dto.responseNote;

      const updatedRequest = await tx.reportRevisionRequest.update({
        where: { id },
        data: updateData,
      });

      return { revisionRequest: updatedRequest, newReport };
    });

    return { data: result };
  }

  // ── Revizyonu Tamamla ────────────────────────────────────────────────────

  async completeRevision(id: string, dto: CompleteRevisionDto, user?: unknown) {
    const revision = await this.assertRevisionClaimAccess(id, user);
    const revisionRequest = await this.prisma.reportRevisionRequest.findUnique({
      where: { id },
    });
    if (!revisionRequest) {
      throw new NotFoundException('Revizyon talebi bulunamadı');
    }
    if (revisionRequest.status !== 'IN_PROGRESS') {
      throw new BadRequestException('Yalnızca IN_PROGRESS durumundaki talepler tamamlanabilir');
    }

    const newReport = await this.prisma.repairReport.findUnique({
      where: { id: dto.newReportId },
    });
    if (!newReport) {
      throw new NotFoundException('Yeni rapor bulunamadı');
    }
    if (newReport.claimFileId !== revision.claimFileId) {
      throw new ForbiddenException(CLAIM_FILE_ACCESS_DENIED);
    }

    const data = await this.prisma.reportRevisionRequest.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        newReportId: dto.newReportId,
        completedAt: new Date(),
        responseNote: dto.responseNote,
      },
      include: {
        report: { select: { id: true, reportNo: true, status: true } },
        newReport: { select: { id: true, reportNo: true, status: true } },
        requestedBy: { select: { id: true, firstName: true, lastName: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return { data };
  }

  // ── Thread Mesajı Ekle ───────────────────────────────────────────────────

  async addMessage(id: string, senderId: string, dto: CreateRevisionMessageDto, user?: unknown) {
    await this.assertRevisionClaimAccess(id, user);
    const revisionRequest = await this.prisma.reportRevisionRequest.findUnique({
      where: { id },
    });
    if (!revisionRequest) {
      throw new NotFoundException('Revizyon talebi bulunamadı');
    }

    const data = await this.prisma.revisionMessage.create({
      data: {
        revisionRequestId: id,
        senderId,
        message: dto.message,
      },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return { data };
  }

  // ── Thread Mesajları ─────────────────────────────────────────────────────

  async getMessages(id: string, user?: unknown) {
    await this.assertRevisionClaimAccess(id, user);
    const revisionRequest = await this.prisma.reportRevisionRequest.findUnique({
      where: { id },
    });
    if (!revisionRequest) {
      throw new NotFoundException('Revizyon talebi bulunamadı');
    }

    const data = await this.prisma.revisionMessage.findMany({
      where: { revisionRequestId: id },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return { data };
  }

  // ── Süresi Geçen Talepler ────────────────────────────────────────────────

  async getOverdue(user?: unknown) {
    const requestingUser = requireRequestUser(user);
    const now = new Date();
    const data = await this.prisma.reportRevisionRequest.findMany({
      where: {
        deadlineAt: { lt: now },
        status: { in: ['REQUESTED', 'IN_PROGRESS'] },
        report: { claimFile: applyClaimFileListScope({}, requestingUser) },
      },
      include: {
        report: { select: { id: true, reportNo: true } },
        requestedBy: { select: { id: true, firstName: true, lastName: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { deadlineAt: 'asc' },
    });

    return { data };
  }

  // ── SLA Cron: Deadline geçenleri ESCALATED yap ──────────────────────────

  @Cron(CronExpression.EVERY_HOUR)
  async escalateOverdueRevisions() {
    const now = new Date();

    const overdue = await this.prisma.reportRevisionRequest.findMany({
      where: {
        deadlineAt: { lt: now },
        status: { in: ['REQUESTED', 'IN_PROGRESS'] },
      },
      select: { id: true },
    });

    if (overdue.length === 0) return;

    const ids = overdue.map((r) => r.id);

    await this.prisma.reportRevisionRequest.updateMany({
      where: { id: { in: ids } },
      data: { status: RevisionStatus.ESCALATED },
    });
  }

  private assertReportClaimAccess(
    claimFile: Parameters<typeof assertClaimFileAccessForRequest>[0] | null,
    user?: unknown,
  ) {
    if (!claimFile) {
      throw new ForbiddenException(CLAIM_FILE_ACCESS_DENIED);
    }
    assertClaimFileAccessForRequest(claimFile, user);
  }

  private async assertRevisionClaimAccess(
    id: string,
    user?: unknown,
  ): Promise<{ claimFileId: string }> {
    const row = await this.prisma.reportRevisionRequest.findUnique({
      where: { id },
      select: {
        id: true,
        report: {
          select: {
            claimFileId: true,
            claimFile: { select: CLAIM_FILE_ACCESS_SELECT },
          },
        },
      },
    });
    if (!row) {
      throw new NotFoundException('Revizyon talebi bulunamadı');
    }
    const claimFile = row.report?.claimFile;
    if (!claimFile || !row.report?.claimFileId) {
      throw new ForbiddenException(CLAIM_FILE_ACCESS_DENIED);
    }
    assertClaimFileAccessForRequest(claimFile, user);
    return { claimFileId: row.report.claimFileId };
  }
}
