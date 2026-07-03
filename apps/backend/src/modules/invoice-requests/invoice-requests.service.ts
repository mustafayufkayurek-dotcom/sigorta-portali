import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { FileDocumentsService } from '../file-documents/file-documents.service';
import { SurveysService } from '@/modules/surveys/surveys.service';
import {
  CreateInvoiceRequestDto,
  UpdateInvoiceRequestStatusDto,
} from './dto/invoice-requests.dto';

@Injectable()
export class InvoiceRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileDocumentsService: FileDocumentsService,
    @Inject(forwardRef(() => SurveysService))
    private readonly surveysService: SurveysService,
  ) {}

  // ── Sıra numarası üret ────────────────────────────────────────────────────

  private async generateRequestNo(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.invoiceRequest.count({
      where: { requestNo: { startsWith: `FT-${year}-` } },
    });
    const seq = String(count + 1).padStart(5, '0');
    return `FT-${year}-${seq}`;
  }

  // ── Kapama koşul kontrolü ─────────────────────────────────────────────────

  async verifyClosureConditions(dto: CreateInvoiceRequestDto) {
    if (dto.serviceType === 'claim' && dto.claimFileId) {
      const conds = await this.fileDocumentsService.checkClaimFileClosureConditions(
        dto.claimFileId,
      );
      if (!conds.canCreateInvoiceRequest) {
        const missing: string[] = [];
        if (!conds.muvafakatnameDigitallyApproved)
          missing.push('Muvafakatname dijital onayı');
        if (!conds.repairReportApproved) missing.push('Onaylı onarım raporu');
        if (!conds.vendorContractSigned) missing.push('İmzalı tedarikçi sözleşmesi');
        throw new BadRequestException(
          `Kapama koşulları tamamlanmamış: ${missing.join(', ')}`,
        );
      }
    }

    if (dto.serviceType === 'emergency' && dto.emergencyCaseId) {
      const conds = await this.fileDocumentsService.checkEmergencyCaseClosureConditions(
        dto.emergencyCaseId,
      );
      if (!conds.canCreateInvoiceRequest) {
        const missing: string[] = [];
        if (!conds.matbuEvrakDigitallyApproved)
          missing.push('Matbu evrak dijital onayı');
        if (!conds.caseStatusCompleted) missing.push('Dosya durumu tamamlanmamış');
        throw new BadRequestException(
          `Kapama koşulları tamamlanmamış: ${missing.join(', ')}`,
        );
      }
    }
  }

  // ── Oluşturma ─────────────────────────────────────────────────────────────

  async create(dto: CreateInvoiceRequestDto, createdByUserId: string) {
    await this.verifyClosureConditions(dto);

    // Mükerrer talep kontrolü
    const existing = await this.prisma.invoiceRequest.findFirst({
      where: {
        ...(dto.claimFileId ? { claimFileId: dto.claimFileId } : {}),
        ...(dto.emergencyCaseId ? { emergencyCaseId: dto.emergencyCaseId } : {}),
        status: { in: ['pending', 'approved'] },
      },
    });
    if (existing) {
      throw new BadRequestException(
        'Bu dosya için zaten bekleyen bir fatura talebi mevcut',
      );
    }

    const requestNo = await this.generateRequestNo();

    return this.prisma.invoiceRequest.create({
      data: {
        requestNo,
        serviceType: dto.serviceType,
        claimFileId: dto.claimFileId ?? null,
        emergencyCaseId: dto.emergencyCaseId ?? null,
        insuranceCompanyId: dto.insuranceCompanyId ?? null,
        insuranceCompanyName: dto.insuranceCompanyName ?? null,
        fileNo: dto.fileNo,
        totalAmount: dto.totalAmount,
        workItemsSummary: dto.workItemsSummary as any,
        notes: dto.notes ?? null,
        status: 'pending',
        createdByUserId,
      },
      include: {
        claimFile: { select: { fileNo: true } },
        emergencyCase: { select: { caseNo: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  // ── Liste (finans dashboard için) ─────────────────────────────────────────

  async findAll(status?: string, serviceType?: string) {
    return this.prisma.invoiceRequest.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(serviceType ? { serviceType } : {}),
      },
      include: {
        claimFile: { select: { fileNo: true, id: true } },
        emergencyCase: { select: { caseNo: true, id: true } },
        insuranceCompany: { select: { name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const req = await this.prisma.invoiceRequest.findUnique({
      where: { id },
      include: {
        claimFile: {
          select: {
            fileNo: true,
            id: true,
            insuranceCompany: { select: { name: true } },
          },
        },
        emergencyCase: { select: { caseNo: true, id: true } },
        insuranceCompany: { select: { name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
        invoice: { select: { id: true, invoiceNo: true, status: true } },
      },
    });
    if (!req) throw new NotFoundException('Fatura talebi bulunamadı');
    return req;
  }

  // ── Dosya bazlı liste ─────────────────────────────────────────────────────

  async findByClaimFile(claimFileId: string) {
    return this.prisma.invoiceRequest.findMany({
      where: { claimFileId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByEmergencyCase(emergencyCaseId: string) {
    return this.prisma.invoiceRequest.findMany({
      where: { emergencyCaseId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Durum güncelleme ──────────────────────────────────────────────────────

  async updateStatus(
    id: string,
    dto: UpdateInvoiceRequestStatusDto,
    userId: string,
  ) {
    await this.findOne(id);

    const updateData: any = { status: dto.status };

    if (dto.status === 'approved') {
      updateData.approvedByUserId = userId;
      updateData.approvedAt = new Date();
    }
    if (dto.status === 'invoiced') {
      updateData.invoicedAt = new Date();
      if (dto.invoiceId) updateData.invoiceId = dto.invoiceId;
    }
    if (dto.notes) updateData.notes = dto.notes;

    const result = await this.prisma.invoiceRequest.update({
      where: { id },
      data: updateData,
    });

    // Faturalanan dosya için otomatik anket kampanyası oluştur
    if (dto.status === 'invoiced') {
      this.surveysService
        .createCampaign({ invoiceRequestId: id })
        .catch(() => {
          // Anket oluşturma hatası fatura işlemini engellemesin
        });
    }

    return result;
  }

  // ── Finans dashboard özeti ────────────────────────────────────────────────

  async getDashboardSummary() {
    const [pendingCount, approvedCount, invoicedCount, cancelledCount] =
      await Promise.all([
        this.prisma.invoiceRequest.count({ where: { status: 'pending' } }),
        this.prisma.invoiceRequest.count({ where: { status: 'approved' } }),
        this.prisma.invoiceRequest.count({ where: { status: 'invoiced' } }),
        this.prisma.invoiceRequest.count({ where: { status: 'cancelled' } }),
      ]);

    const pendingAmount = await this.prisma.invoiceRequest.aggregate({
      _sum: { totalAmount: true },
      where: { status: 'pending' },
    });
    const approvedAmount = await this.prisma.invoiceRequest.aggregate({
      _sum: { totalAmount: true },
      where: { status: 'approved' },
    });
    const invoicedAmount = await this.prisma.invoiceRequest.aggregate({
      _sum: { totalAmount: true },
      where: { status: 'invoiced' },
    });

    const recentRequests = await this.prisma.invoiceRequest.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        claimFile: { select: { fileNo: true } },
        emergencyCase: { select: { caseNo: true } },
        insuranceCompany: { select: { name: true } },
      },
    });

    // Dönemsel (son 6 ay)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // Dönemsel (son 6 ay) — raw aggregate
    const monthlyInvoiced = await this.prisma.invoiceRequest.findMany({
      where: {
        status: 'invoiced',
        invoicedAt: { gte: sixMonthsAgo },
      },
      select: {
        invoicedAt: true,
        totalAmount: true,
      },
      orderBy: { invoicedAt: 'desc' },
    });

    return {
      counts: { pendingCount, approvedCount, invoicedCount, cancelledCount },
      amounts: {
        pendingAmount: pendingAmount._sum.totalAmount ?? 0,
        approvedAmount: approvedAmount._sum.totalAmount ?? 0,
        invoicedAmount: invoicedAmount._sum.totalAmount ?? 0,
      },
      recentRequests,
      monthlyInvoiced,
    };
  }
}
