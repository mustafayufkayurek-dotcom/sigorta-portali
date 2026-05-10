import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@/prisma/prisma.service';
import { ClaimEventEmailService } from '@/modules/notifications/email/claim-event-email.service';
import {
  CreateRevisionRequestDto,
  UpdateRevisionStatusDto,
  ListRevisionRequestsDto,
  CreateRevisionMessageDto,
  StartRevisionDto,
  CompleteRevisionDto,
  RevisionStatus,
} from './dto/revision-requests.dto';

@Injectable()
export class RevisionRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly claimEventEmail?: ClaimEventEmailService,
  ) {}

  // ── Revizyon Talebi Oluştur ──────────────────────────────────────────────

  async create(requestedById: string, dto: CreateRevisionRequestDto) {
    const report = await this.prisma.repairReport.findUnique({
      where: { id: dto.reportId },
      include: { claimFile: { select: { id: true, fileNo: true } } },
    });
    if (!report) {
      throw new NotFoundException('Rapor bulunamadı');
    }

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

  async findAll(query: ListRevisionRequestsDto) {
    const where: Record<string, unknown> = {};

    if (query.status) where.status = query.status;
    if (query.reportId) where.reportId = query.reportId;
    if (query.assignedToId) where.assignedToId = query.assignedToId;
    if (query.priority) where.priority = query.priority;

    const data = await this.prisma.reportRevisionRequest.findMany({
      where,
      include: {
        report: { select: { id: true, reportNo: true, status: true } },
        requestedBy: { select: { id: true, firstName: true, lastName: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { messages: true } },
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return { data };
  }

  // ── Talep Detayı ─────────────────────────────────────────────────────────

  async findOne(id: string) {
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

  async updateStatus(id: string, dto: UpdateRevisionStatusDto) {
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

  async startRevision(id: string, userId: string, dto: StartRevisionDto) {
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
    const maxVersion = allVersions.reduce((max, v) => Math.max(max, v.versionNo), 1);
    const newVersionNo = maxVersion + 1;

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

  async completeRevision(id: string, dto: CompleteRevisionDto) {
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

  async addMessage(id: string, senderId: string, dto: CreateRevisionMessageDto) {
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

  async getMessages(id: string) {
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

  async getOverdue() {
    const now = new Date();
    const data = await this.prisma.reportRevisionRequest.findMany({
      where: {
        deadlineAt: { lt: now },
        status: { in: ['REQUESTED', 'IN_PROGRESS'] },
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
}
