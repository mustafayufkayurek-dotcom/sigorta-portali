import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Optional,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { buildAppPath } from '@/common/utils/app-url';
import { ReportPdfService } from './pdf/report-pdf.service';
import { ReportEmailService } from './email/report-email.service';
import { ClaimEventEmailService } from '@/modules/notifications/email/claim-event-email.service';
import { AnomalyDetectionService } from '@/modules/vendor-risk/anomaly-detection.service';
import { VendorRiskService } from '@/modules/vendor-risk/vendor-risk.service';
import { DamageRepairTemplatesService } from '@/modules/damage-repair-templates/damage-repair-templates.service';
import { ExternalApprovalsService } from '@/modules/external-approvals/external-approvals.service';
import { normalizeReportImageCategory } from './report-image-category';
import { resolveReportImageFilePath } from './report-image-paths';
import {
  isExpertFirmCustomer,
  REPAIR_REPORT_INITIAL_VERSION,
  REPAIR_REPORT_MAX_REVISION_MESSAGE,
  canCreateRepairReportRevision,
  canStartRepairReportRevisionFromStatus,
  nextRepairReportVersionNo,
  repairReportClosesOnRevise,
} from '@sigorta/shared';
import {
  CreateRepairReportDto,
  UpdateRepairReportDto,
  CreateReportItemDto,
  UpdateReportItemDto,
  CreateDamageTypeDto,
  SendEmailDto,
  AddQuickRepairItemsDto,
} from './dto/repair-reports.dto';
import * as fs from 'fs';
import { randomUUID } from 'crypto';

interface DownloadToken {
  reportId: string;
  view: 'internal' | 'external';
  expiresAt: number;
}

// In-memory token store (5 min TTL)
const downloadTokenStore = new Map<string, DownloadToken>();

/** Manuel red / rapor reddi sonrası leftover yazım raporları (onaylıya dokunulmaz). */
export const OPEN_WRITING_REPORT_STATUSES = ['draft', 'submitted'] as const;

/**
 * claimFile SELECT — skaler kolonları açıkça listeler.
 * `include: claimFile` Prisma şemasındaki tüm skalerleri (örn. assigned_inspector_vendor_id)
 * çeker; kolon migrate edilmemiş DB’de PDF getReport kırılır.
 */
const CLAIM_FILE_SAFE_SELECT = {
  id: true,
  fileNo: true,
  claimNo: true,
  lossType: true,
  insuredName: true,
  commercialTitle: true,
  insuranceCompany: true,
  currentStatus: { select: { id: true, code: true, name: true, color: true } },
  customer: { include: { contacts: { where: { phone: { not: null } }, orderBy: { isPrimary: 'desc' as const } } } },
  propertyAddress: true,
  claimSubject: { select: { id: true, code: true, name: true } },
  assignedFieldUser: { select: { id: true, firstName: true, lastName: true, phone: true } },
  assignedOfficeUser: { select: { id: true, firstName: true, lastName: true, phone: true } },
  assignedAdjuster: { select: { id: true, firstName: true, lastName: true, phone: true } },
  assignedSupplier: { select: { id: true, name: true, phone: true, authorizedPhone: true } },
  supplierAssignments: {
    orderBy: [{ sortOrder: 'asc' as const }, { assignedAt: 'asc' as const }],
    include: {
      vendor: { select: { id: true, name: true, phone: true, authorizedPhone: true } },
    },
  },
};

const REPORT_INCLUDE_CORE = {
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  revisedBy: { select: { id: true, firstName: true, lastName: true } },
  originalReport: { select: { id: true, reportNo: true, versionNo: true } },
  versions: {
    select: { id: true, reportNo: true, versionNo: true, status: true, createdAt: true, revisedAt: true },
    orderBy: { versionNo: 'asc' as const },
  },
  items: {
    include: { workGroup: true, damageType: true },
    orderBy: [{ workGroup: { sortOrder: 'asc' as const } }, { sortOrder: 'asc' as const }],
  },
  images: { orderBy: { sortOrder: 'asc' as const } },
  damageTypes: { orderBy: { sortOrder: 'asc' as const } },
  approvalHistory: {
    include: { user: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { createdAt: 'desc' as const },
  },
  expertOffice: {
    select: {
      id: true,
      companyName: true,
      phone: true,
      email: true,
    },
  },
};

/** PDF / getReport — migrate edilmemiş kolonlara dayanmayan güvenli include */
const REPORT_INCLUDE_SAFE = {
  claimFile: { select: CLAIM_FILE_SAFE_SELECT },
  ...REPORT_INCLUDE_CORE,
};

/** Kolon mevcut ortamlarda eksper firması da istenebilir (create/update) */
const REPORT_INCLUDE = {
  claimFile: {
    select: {
      ...CLAIM_FILE_SAFE_SELECT,
      assignedInspectorVendor: { select: { id: true, name: true, phone: true, authorizedPhone: true } },
    },
  },
  ...REPORT_INCLUDE_CORE,
};

function isMissingAssignedInspectorVendorColumn(error: unknown): boolean {
  const msg = String((error as { message?: string })?.message ?? error ?? '');
  return msg.includes('assigned_inspector_vendor_id');
}

@Injectable()
export class RepairReportsService {
  private readonly logger = new Logger(RepairReportsService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private pdfService: ReportPdfService,
    private emailService: ReportEmailService,
    private readonly externalApprovals: ExternalApprovalsService,
    @Optional() private readonly claimEventEmail?: ClaimEventEmailService,
    @Optional() private readonly damageRepairTemplates?: DamageRepairTemplatesService,
    @Optional() private readonly anomalyDetection?: AnomalyDetectionService,
    @Optional() private readonly vendorRisk?: VendorRiskService,
  ) {}

  // ── Reports ─────────────────────────────────────────────────────────────────

  async getReportsByClaimFile(claimFileId: string) {
    const claimFile = await this.prisma.claimFile.findUnique({ where: { id: claimFileId } });
    if (!claimFile) throw new NotFoundException('Hasar dosyası bulunamadı');
    return this.prisma.repairReport.findMany({
      where: { claimFileId },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { items: true, images: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async loadClaimFileForCreate(claimFileId: string) {
    try {
      return await this.prisma.claimFile.findUnique({
        where: { id: claimFileId },
        include: {
          assignedAdjuster: { select: { id: true, firstName: true, lastName: true } },
          assignedOfficeUser: { select: { id: true, firstName: true, lastName: true } },
          assignedInspectorVendor: { select: { id: true, name: true } },
          customer: {
            select: {
              id: true,
              type: true,
              entityType: true,
              subType: true,
              companyName: true,
              fullName: true,
            },
          },
        },
      });
    } catch (error) {
      if (!isMissingAssignedInspectorVendorColumn(error)) throw error;
      this.logger.warn('assigned_inspector_vendor_id yok — createReport claim include fallback');
      return this.prisma.claimFile.findUnique({
        where: { id: claimFileId },
        include: {
          assignedAdjuster: { select: { id: true, firstName: true, lastName: true } },
          assignedOfficeUser: { select: { id: true, firstName: true, lastName: true } },
          customer: {
            select: {
              id: true,
              type: true,
              entityType: true,
              subType: true,
              companyName: true,
              fullName: true,
            },
          },
        },
      });
    }
  }

  private async findReportWithInclude(id: string) {
    // SAFE select: claim_files skalerlerinde assigned_inspector_vendor_id yok.
    // Eksper firması ikinci sorguda (kolon varsa) eklenir.
    const report = await this.prisma.repairReport.findUnique({
      where: { id },
      include: REPORT_INCLUDE_SAFE,
    });
    if (!report?.claimFile) return report;

    try {
      const rows = await this.prisma.$queryRaw<Array<{ id: string; name: string | null; phone: string | null; authorized_phone: string | null }>>`
        SELECT v.id, v.name, v.phone, v.authorized_phone
        FROM claim_files cf
        INNER JOIN vendors v ON v.id = cf.assigned_inspector_vendor_id
        WHERE cf.id = ${report.claimFileId}
        LIMIT 1
      `;
      const v = rows[0];
      if (v) {
        (report.claimFile as { assignedInspectorVendor?: unknown }).assignedInspectorVendor = {
          id: v.id,
          name: v.name,
          phone: v.phone,
          authorizedPhone: v.authorized_phone,
        };
      }
    } catch (error) {
      // Kolon yoksa raw SQL da düşer — PDF için kritik değil
      if (!isMissingAssignedInspectorVendorColumn(error)) {
        this.logger.warn(
          `Inspector vendor zenginleştirme atlandı: ${(error as Error)?.message ?? error}`,
        );
      }
    }
    return report;
  }

  private async mutateReportWithInclude(
    action: 'create' | 'update',
    args: { where?: { id: string }; data: Record<string, unknown> },
  ) {
    try {
      if (action === 'create') {
        return await this.prisma.repairReport.create({
          data: args.data as any,
          include: REPORT_INCLUDE,
        });
      }
      return await this.prisma.repairReport.update({
        where: args.where!,
        data: args.data as any,
        include: REPORT_INCLUDE,
      });
    } catch (error) {
      if (!isMissingAssignedInspectorVendorColumn(error)) throw error;
      this.logger.warn('assigned_inspector_vendor_id yok — mutate include fallback');
      if (action === 'create') {
        return this.prisma.repairReport.create({
          data: args.data as any,
          include: REPORT_INCLUDE_SAFE,
        });
      }
      return this.prisma.repairReport.update({
        where: args.where!,
        data: args.data as any,
        include: REPORT_INCLUDE_SAFE,
      });
    }
  }

  async createReport(claimFileId: string, dto: CreateRepairReportDto, userId: string) {
    const claimFile = await this.loadClaimFileForCreate(claimFileId);
    if (!claimFile) throw new NotFoundException('Hasar dosyası bulunamadı');

    // Raporlayan: login olan kullanıcı
    const reporter = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });
    const autoReporterName = reporter ? `${reporter.firstName} ${reporter.lastName}` : undefined;

    // Eksper: dto veya atanmış eksper firması; dosya sorumlusu (assignedOfficeUser) asla eksper adı olmaz
    const vendorName = (claimFile as { assignedInspectorVendor?: { name?: string | null } | null })
      .assignedInspectorVendor?.name;
    const autoInspectorName = dto.inspectorName
      ?? vendorName
      ?? undefined;

    // Müşteri kartı (ekspertiz firması) → expertOffice; dto öncelikli
    const autoExpertOfficeId =
      dto.expertOfficeId
      ?? (isExpertFirmCustomer(claimFile.customer) ? claimFile.customer!.id : undefined);

    const count = await this.prisma.repairReport.count({ where: { claimFileId } });
    const reportNo = `RPT-${claimFile.fileNo}-${(count + 1).toString().padStart(3, '0')}`;

    return this.mutateReportWithInclude('create', {
      data: {
        claimFileId,
        reportNo,
        reportType: dto.reportType ?? 'single',
        reportDate: new Date(dto.reportDate),
        inspectorName: autoInspectorName,
        reporterName: autoReporterName,
        findingsText: dto.findingsText,
        legalNotes: dto.legalNotes,
        quickDamageTypes: dto.quickDamageTypes ?? [],
        quickDamageSize: dto.quickDamageSize,
        departmentId: dto.departmentId,
        expertOfficeId: autoExpertOfficeId,
        createdByUserId: userId,
        versionNo: REPAIR_REPORT_INITIAL_VERSION,
      },
    });
  }

  async getReport(id: string) {
    const report = await this.findReportWithInclude(id);
    if (!report) throw new NotFoundException('Rapor bulunamadı');

    const earliestInbound = await this.prisma.inboundMessage.findFirst({
      where: { claimFileId: report.claimFileId },
      orderBy: { receivedAt: 'asc' },
      select: { receivedAt: true },
    });

    const claim = report.claimFile as {
      assignedInspectorVendor?: { name?: string | null } | null;
      inboundReceivedAt?: Date | null;
    } | null;
    if (claim) {
      claim.inboundReceivedAt = earliestInbound?.receivedAt ?? null;
    }
    const vendorName = claim?.assignedInspectorVendor?.name?.trim();
    if (!report.inspectorName?.trim() && vendorName) {
      return { ...report, inspectorName: vendorName };
    }

    return report;
  }

  async updateReport(id: string, dto: UpdateRepairReportDto) {
    const report = await this.prisma.repairReport.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('Rapor bulunamadı');
    const lockedStatuses = ['submitted', 'pending_approval', 'approved', 'sent_for_external_approval', 'externally_approved', 'externally_rejected'];
    if (lockedStatuses.includes(report.status)) {
      throw new BadRequestException('Bu durumdaki rapor düzenlenemez');
    }

    return this.mutateReportWithInclude('update', {
      where: { id },
      data: {
        ...dto,
        reportDate: dto.reportDate ? new Date(dto.reportDate) : undefined,
      },
    });
  }

  async deleteReport(id: string) {
    const report = await this.prisma.repairReport.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('Rapor bulunamadı');
    if (report.status !== 'draft') throw new BadRequestException('Yalnızca taslak raporlar silinebilir');
    await this.prisma.repairReport.delete({ where: { id } });
    return { message: 'Rapor silindi' };
  }

  async submitReport(id: string) {
    const report = await this.prisma.repairReport.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('Rapor bulunamadı');
    const editableStatuses = ['draft', 'rejected'];
    if (!editableStatuses.includes(report.status)) {
      throw new BadRequestException('Bu rapor şu anda sunulamaz');
    }
    return this.prisma.repairReport.update({
      where: { id },
      data: { status: 'submitted' },
    });
  }

  // ── Damage Types ─────────────────────────────────────────────────────────────

  async addDamageType(reportId: string, dto: CreateDamageTypeDto) {
    const report = await this.prisma.repairReport.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Rapor bulunamadı');
    return this.prisma.reportDamageType.create({
      data: {
        reportId,
        damageTypeCode: dto.damageTypeCode,
        damageTypeName: dto.damageTypeName,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async removeDamageType(id: string) {
    const dt = await this.prisma.reportDamageType.findUnique({ where: { id } });
    if (!dt) throw new NotFoundException('Hasar nedeni bulunamadı');
    // Unlink items before delete
    await this.prisma.repairReportItem.updateMany({
      where: { damageTypeId: id },
      data: { damageTypeId: null },
    });
    await this.prisma.reportDamageType.delete({ where: { id } });
    return { message: 'Hasar nedeni kaldırıldı' };
  }

  // ── Items ─────────────────────────────────────────────────────────────────

  async addItem(reportId: string, dto: CreateReportItemDto) {
    const report = await this.prisma.repairReport.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Rapor bulunamadı');
    const lockedStatuses = ['submitted', 'pending_approval', 'approved', 'sent_for_external_approval', 'externally_approved', 'externally_rejected'];
    if (lockedStatuses.includes(report.status)) {
      throw new BadRequestException('Bu durumdaki rapora kalem eklenemez');
    }

    if (report.reportType === 'multi' && !dto.damageTypeId) {
      throw new BadRequestException('Çok hasarlı raporda kalem için hasar nedeni zorunludur');
    }

    const pricingType = dto.pricingType ?? 'unit';
    const lumpSumPrice = dto.lumpSumPrice;
    let supplierTotal: number;
    let salesTotal: number;

    if (pricingType === 'lumpsum' && lumpSumPrice != null) {
      supplierTotal = lumpSumPrice;
      salesTotal = lumpSumPrice;
    } else {
      supplierTotal = dto.quantity * dto.supplierUnitPrice;
      salesTotal = dto.quantity * dto.salesUnitPrice;
    }
    const marginPct = salesTotal > 0 ? ((salesTotal - supplierTotal) / salesTotal) * 100 : 0;

    const item = await this.prisma.repairReportItem.create({
      data: {
        reportId,
        workGroupId: dto.workGroupId,
        damageTypeId: dto.damageTypeId,
        location: dto.location,
        jobDescription: dto.jobDescription,
        description: dto.description,
        quantity: dto.quantity,
        unit: dto.unit,
        supplierUnitPrice: dto.supplierUnitPrice,
        salesUnitPrice: dto.salesUnitPrice,
        supplierTotal,
        salesTotal,
        marginPct,
        sortOrder: dto.sortOrder ?? 0,
        metrajData: dto.metrajData as any,
        pricingType,
        lumpSumPrice: dto.lumpSumPrice,
        materialIncluded: dto.materialIncluded ?? true,
        laborIncluded: dto.laborIncluded ?? true,
        damageCategory: dto.damageCategory || 'bina',
      },
      include: { workGroup: true, damageType: true },
    });

    // Record price history
    await this.prisma.supplierPriceHistory.create({
      data: {
        workGroupId: dto.workGroupId,
        jobDescription: dto.jobDescription,
        unit: dto.unit,
        supplierUnitPrice: dto.supplierUnitPrice,
        salesUnitPrice: dto.salesUnitPrice,
        claimFileId: report.claimFileId,
      },
    });

    await this.recalculateTotals(reportId);
    return item;
  }

  async addQuickRepairItems(reportId: string, dto: AddQuickRepairItemsDto) {
    const report = await this.prisma.repairReport.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Rapor bulunamadı');
    const lockedStatuses = ['submitted', 'pending_approval', 'approved', 'sent_for_external_approval', 'externally_approved', 'externally_rejected'];
    if (lockedStatuses.includes(report.status)) {
      throw new BadRequestException('Bu durumdaki rapora kalem eklenemez');
    }
    if (!dto.items?.length) throw new BadRequestException('Eklenecek kalem seçilmedi');

    const subGroups = await this.prisma.workSubGroup.findMany({
      where: { id: { in: dto.items.map((item) => item.workSubGroupId) } },
      include: { workGroup: true },
    });
    const subGroupMap = new Map(subGroups.map((subGroup) => [subGroup.id, subGroup]));
    const reportDamageTypes = await this.prisma.reportDamageType.findMany({
      where: { reportId },
      orderBy: { sortOrder: 'asc' },
    });
    const defaultDamageTypeId = reportDamageTypes.length === 1
      ? reportDamageTypes[0].id
      : reportDamageTypes[0]?.id ?? null;
    const created = [];
    for (const item of dto.items) {
      const subGroup = subGroupMap.get(item.workSubGroupId);
      if (!subGroup) throw new NotFoundException('İş kalemi bulunamadı');
      const quantity = item.quantity || 1;
      const unitPrice = subGroup.unitPrice ? Number(subGroup.unitPrice) : 0;
      const createdItem = await this.prisma.repairReportItem.create({
        data: {
          reportId,
          workGroupId: subGroup.workGroupId,
          damageTypeId: defaultDamageTypeId,
          jobDescription: subGroup.name,
          description: item.note,
          quantity,
          unit: subGroup.unitType,
          supplierUnitPrice: unitPrice,
          salesUnitPrice: unitPrice,
          supplierTotal: quantity * unitPrice,
          salesTotal: quantity * unitPrice,
          marginPct: 0,
          damageCategory: 'bina',
        },
        include: { workGroup: true, damageType: true },
      });
      created.push(createdItem);
    }

    await this.prisma.repairReport.update({
      where: { id: reportId },
      data: {
        quickDamageTypes: dto.damageTypes ?? report.quickDamageTypes,
      },
    });
    await this.damageRepairTemplates?.incrementUsageForItems(dto.items.map((item) => item.workSubGroupId), dto.damageTypes ?? [], dto.fileId);
    await this.recalculateTotals(reportId);
    return created;
  }

  async updateItem(itemId: string, dto: UpdateReportItemDto) {
    const item = await this.prisma.repairReportItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Kalem bulunamadı');

    const pricingType = dto.pricingType ?? item.pricingType;
    const quantity = dto.quantity ?? item.quantity;
    const supplierUnitPrice = dto.supplierUnitPrice ?? item.supplierUnitPrice;
    const salesUnitPrice = dto.salesUnitPrice ?? item.salesUnitPrice;
    const lumpSumPrice = dto.lumpSumPrice ?? item.lumpSumPrice;

    let supplierTotal: number;
    let salesTotal: number;

    if (pricingType === 'lumpsum' && lumpSumPrice != null) {
      supplierTotal = lumpSumPrice;
      salesTotal = lumpSumPrice;
    } else {
      supplierTotal = quantity * supplierUnitPrice;
      salesTotal = quantity * salesUnitPrice;
    }
    const marginPct = salesTotal > 0 ? ((salesTotal - supplierTotal) / salesTotal) * 100 : 0;

    const updated = await this.prisma.repairReportItem.update({
      where: { id: itemId },
      data: {
        ...dto,
        supplierTotal,
        salesTotal,
        marginPct,
        metrajData: dto.metrajData as any,
      },
      include: { workGroup: true, damageType: true },
    });

    await this.recalculateTotals(item.reportId);
    return updated;
  }

  async removeItem(itemId: string) {
    const item = await this.prisma.repairReportItem.findUnique({
      where: { id: itemId },
      include: { report: { select: { status: true } } },
    });
    if (!item) throw new NotFoundException('Kalem bulunamadı');
    const lockedStatuses = ['submitted', 'pending_approval', 'approved', 'sent_for_external_approval', 'externally_approved', 'externally_rejected'];
    if (lockedStatuses.includes((item as any).report?.status ?? '')) {
      throw new BadRequestException('Bu durumdaki rapordan kalem silinemez');
    }
    await this.prisma.repairReportItem.delete({ where: { id: itemId } });
    await this.recalculateTotals(item.reportId);
    return { message: 'Kalem silindi' };
  }

  async reorderItems(_reportId: string, orders: Array<{ id: string; sortOrder: number }>) {
    await Promise.all(
      orders.map((o) =>
        this.prisma.repairReportItem.update({
          where: { id: o.id },
          data: { sortOrder: o.sortOrder },
        }),
      ),
    );
    return { message: 'Sıralama güncellendi' };
  }

  private async recalculateTotals(reportId: string) {
    const items = await this.prisma.repairReportItem.findMany({ where: { reportId } });
    const totalSupplierCost = items.reduce((s: number, i: { supplierTotal: number }) => s + i.supplierTotal, 0);
    const totalSalesAmount = items.reduce((s: number, i: { salesTotal: number; pricingType: string; lumpSumPrice: number | null }) =>
      s + (i.pricingType === 'lumpsum' ? (i.lumpSumPrice ?? 0) : i.salesTotal), 0);
    const grossProfit = totalSalesAmount - totalSupplierCost;
    const grossMarginPct = totalSalesAmount > 0 ? (grossProfit / totalSalesAmount) * 100 : 0;

    const buildingDamageTotal = items.reduce((s: number, i: { damageCategory: string; salesTotal: number; pricingType: string; lumpSumPrice: number | null }) =>
      (i.damageCategory ?? 'bina') === 'bina' ? s + (i.pricingType === 'lumpsum' ? (i.lumpSumPrice ?? 0) : i.salesTotal) : s, 0);
    const goodsDamageTotal = items.reduce((s: number, i: { damageCategory: string; salesTotal: number; pricingType: string; lumpSumPrice: number | null }) =>
      (i.damageCategory ?? 'bina') === 'esya' ? s + (i.pricingType === 'lumpsum' ? (i.lumpSumPrice ?? 0) : i.salesTotal) : s, 0);

    const report = await this.prisma.repairReport.update({
      where: { id: reportId },
      data: { totalSupplierCost, totalSalesAmount, grossProfit, grossMarginPct, buildingDamageTotal, goodsDamageTotal },
    });
    await this.syncClaimFromLatestReport(report.claimFileId);
  }

  /** Son onarım raporu toplamlarını claim dosyası beklenti alanlarına yansıt */
  private async syncClaimFromLatestReport(claimFileId: string) {
    const latest = await this.prisma.repairReport.findFirst({
      where: { claimFileId },
      orderBy: { updatedAt: 'desc' },
      select: {
        totalSalesAmount: true,
        totalSupplierCost: true,
        grossProfit: true,
      },
    });
    if (!latest) return;
    await this.prisma.claimFile.update({
      where: { id: claimFileId },
      data: {
        approvedBudgetAmount: latest.totalSalesAmount,
        estimatedCostAmount: latest.totalSupplierCost,
        profitAmount: latest.grossProfit,
      },
    });
    await this.prisma.claimFinancialSummary.upsert({
      where: { claimFileId },
      create: {
        claimFileId,
        estimatedRevenue: latest.totalSalesAmount,
        estimatedCost: latest.totalSupplierCost,
        actualRevenue: 0,
        actualCost: 0,
        grossProfit: 0,
        lastCalculatedAt: new Date(),
      },
      update: {
        estimatedRevenue: latest.totalSalesAmount,
        estimatedCost: latest.totalSupplierCost,
      },
    });
  }

  // ── Images ────────────────────────────────────────────────────────────────

  async addImage(
    reportId: string,
    file: Express.Multer.File,
    category?: string,
    caption?: string,
  ) {
    const report = await this.prisma.repairReport.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Rapor bulunamadı');
    const count = await this.prisma.reportImage.count({ where: { reportId } });
    return this.prisma.reportImage.create({
      data: {
        reportId,
        storageKey: file.filename,
        fileName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        category: normalizeReportImageCategory(category),
        caption,
        sortOrder: count,
      },
    });
  }

  async getImages(reportId: string) {
    const report = await this.prisma.repairReport.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Rapor bulunamadı');
    return this.prisma.reportImage.findMany({
      where: { reportId },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  async updateImage(imageId: string, dto: { category?: string; caption?: string }) {
    const img = await this.prisma.reportImage.findUnique({ where: { id: imageId } });
    if (!img) throw new NotFoundException('Fotoğraf bulunamadı');
    const data = {
      ...dto,
      ...(dto.category !== undefined ? { category: normalizeReportImageCategory(dto.category) } : {}),
    };
    return this.prisma.reportImage.update({ where: { id: imageId }, data });
  }

  async saveAnnotation(imageId: string, annotationData: Record<string, unknown>) {
    const img = await this.prisma.reportImage.findUnique({ where: { id: imageId } });
    if (!img) throw new NotFoundException('Fotoğraf bulunamadı');
    return this.prisma.reportImage.update({
      where: { id: imageId },
      data: { hasAnnotation: true, annotationData: annotationData as any },
    });
  }

  async deleteImage(imageId: string) {
    const img = await this.prisma.reportImage.findUnique({ where: { id: imageId } });
    if (!img) throw new NotFoundException('Fotoğraf bulunamadı');
    try {
      const filePath = resolveReportImageFilePath(img.storageKey);
      if (filePath) fs.unlinkSync(filePath);
      if (img.annotatedKey) {
        const annotated = resolveReportImageFilePath(img.annotatedKey);
        if (annotated) fs.unlinkSync(annotated);
      }
    } catch {
      /* dosya yoksa DB kaydı yine silinir */
    }
    await this.prisma.reportImage.delete({ where: { id: imageId } });
    return { message: 'Fotoğraf silindi' };
  }

  async streamImageFile(imageId: string): Promise<{ filePath: string; mimeType: string }> {
    const img = await this.prisma.reportImage.findUnique({ where: { id: imageId } });
    if (!img) throw new NotFoundException('Fotoğraf bulunamadı');
    // Annotasyon dosyası kayıpsa orijinale düş — aksi halde tüm galeri «Yüklenemedi»
    const keys = [
      img.hasAnnotation && img.annotatedKey ? img.annotatedKey : null,
      img.storageKey,
    ].filter(Boolean) as string[];
    let filePath: string | null = null;
    for (const key of keys) {
      filePath = resolveReportImageFilePath(key);
      if (filePath) break;
    }
    if (!filePath) {
      throw new NotFoundException('Fotoğraf dosyası bulunamadı');
    }
    return { filePath, mimeType: img.mimeType ?? 'image/jpeg' };
  }

  // ── Damage Summary ─────────────────────────────────────────────────────────

  async getDamageSummary(reportId: string) {
    const report = await this.prisma.repairReport.findUnique({
      where: { id: reportId },
      include: {
        damageTypes: true,
        items: { include: { damageType: true } },
      },
    });
    if (!report) throw new NotFoundException('Rapor bulunamadı');

    const damageTypes = (report.damageTypes ?? []).map((dt: { id: string; damageTypeName: string }) => {
      const dtItems = report.items.filter((i: { damageTypeId: string | null }) => i.damageTypeId === dt.id);
      const supplierTotal = dtItems.reduce((s: number, i: { supplierTotal: number }) => s + i.supplierTotal, 0);
      const salesTotal = dtItems.reduce((s: number, i: { salesTotal: number }) => s + i.salesTotal, 0);
      const marginPct = salesTotal > 0 ? ((salesTotal - supplierTotal) / salesTotal) * 100 : 0;
      return { id: dt.id, name: dt.damageTypeName, supplierTotal, salesTotal, marginPct };
    });

    const unassignedItems = report.items.filter((i: { damageTypeId: string | null }) => !i.damageTypeId);
    const unassigned = {
      supplierTotal: unassignedItems.reduce((s: number, i: { supplierTotal: number }) => s + i.supplierTotal, 0),
      salesTotal: unassignedItems.reduce((s: number, i: { salesTotal: number }) => s + i.salesTotal, 0),
    };

    return { damageTypes, unassigned };
  }

  // ── PDF & Email ────────────────────────────────────────────────────────────

  /** PDF için minimal claimFile — migrate edilmemiş skaler kolonlara dayanmaz */
  private async getReportForPdf(reportId: string) {
    const report = await this.prisma.repairReport.findUnique({
      where: { id: reportId },
      include: {
        claimFile: {
          select: {
            id: true,
            fileNo: true,
            claimNo: true,
            lossType: true,
            insuredName: true,
            insuredPhone: true,
            commercialTitle: true,
            insuranceCompany: { select: { name: true } },
            customer: { select: { fullName: true, companyName: true, entityType: true, subType: true, firstName: true, lastName: true } },
            claimSubject: { select: { name: true } },
            propertyAddress: { select: { city: true, district: true, addressLine: true } },
            assignedOfficeUser: { select: { firstName: true, lastName: true } },
          },
        },
        expertOffice: {
          select: { id: true, companyName: true, phone: true, email: true },
        },
        originalReport: { select: { id: true, reportNo: true, versionNo: true, createdAt: true } },
        items: {
          include: { workGroup: true, damageType: true },
          orderBy: [{ workGroup: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
        },
        images: { orderBy: { sortOrder: 'asc' } },
        damageTypes: { orderBy: { sortOrder: 'asc' } },
        approvalHistory: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!report) throw new NotFoundException('Rapor bulunamadı');
    return report;
  }

  async generatePdf(reportId: string, viewType: 'internal' | 'external'): Promise<{ buffer: Buffer; report: any }> {
    // PDF kök nedeni: getReport() claimFile include ile şema gerisi kolonları isterdi.
    // PDF yalnız gerekli alanları select eder.
    const report = await this.getReportForPdf(reportId);
    try {
      const buffer = await this.pdfService.generate(report as any, viewType);
      return { buffer, report };
    } catch (error) {
      this.logger.error(`PDF generation failed for report ${reportId}: ${(error as Error)?.message ?? error}`);
      throw error;
    }
  }

  async sendEmail(reportId: string, dto: SendEmailDto) {
    const report = await this.getReport(reportId);
    // PDF önce — ek yoksa sendReport FAIL eder
    const { buffer: pdfBuffer } = await this.generatePdf(reportId, dto.viewType);
    if (!pdfBuffer?.length) {
      throw new BadRequestException('PDF oluşmadı — e-posta gönderilemez');
    }
    const subject = dto.subject ?? `Hasar Onarım Raporu — ${report.reportNo}`;
    return this.emailService.sendReport({
      to: dto.to,
      subject,
      pdfBuffer,
      reportNo: report.reportNo,
      viewType: dto.viewType,
    });
  }

  async getShareLink(reportId: string, userId: string) {
    const report = await this.prisma.repairReport.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Rapor bulunamadı');

    // Mevcut aktif paylaşım token'ını bul veya yeni oluştur
    let approval = await this.prisma.externalApproval.findFirst({
      where: {
        reportId,
        approverType: 'share_link',
        status: 'pending',
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!approval) {
      const token = randomUUID();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 gün
      approval = await this.prisma.externalApproval.create({
        data: {
          reportId,
          approverType: 'share_link',
          approverName: 'Paylaşım Linki',
          channel: 'whatsapp',
          token,
          expiresAt,
          sentByUserId: userId,
        },
      });
    }

    const baseUrl = buildAppPath(this.config, '');
    const url = `${baseUrl}/onay/${approval.token}`;
    return {
      url,
      whatsappUrl: `https://api.whatsapp.com/send?text=${encodeURIComponent(`Hasar Onarım Raporu: ${url}`)}`,
    };
  }

  // ── Download Token (WhatsApp) ─────────────────────────────────────────────

  async createDownloadToken(reportId: string, view: 'internal' | 'external' = 'external') {
    const report = await this.prisma.repairReport.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Rapor bulunamadı');

    // Clean expired tokens
    const now = Date.now();
    for (const [key, val] of downloadTokenStore.entries()) {
      if (val.expiresAt < now) downloadTokenStore.delete(key);
    }

    const token = randomUUID();
    downloadTokenStore.set(token, {
      reportId,
      view,
      expiresAt: now + 5 * 60 * 1000, // 5 minutes
    });

    return { token, expiresInSeconds: 300 };
  }

  async getPdfByToken(token: string): Promise<{
    buffer: Buffer | string;
    reportNo: string;
    view: string;
    fileNo: string;
    insuranceCompanyName: string | null;
    expertOfficeName: string | null;
  }> {
    const entry = downloadTokenStore.get(token);
    if (!entry || entry.expiresAt < Date.now()) {
      throw new BadRequestException('Geçersiz veya süresi dolmuş token');
    }

    const report = await this.getReport(entry.reportId);
    const buffer = await this.pdfService.generate(report as any, entry.view as 'internal' | 'external');
    return {
      buffer,
      reportNo: report.reportNo,
      view: entry.view,
      fileNo: (report.claimFile as any)?.fileNo ?? report.reportNo,
      insuranceCompanyName: (report.claimFile as any)?.insuranceCompany?.name ?? null,
      expertOfficeName: (report.expertOffice as any)?.companyName ?? null,
    };
  }

  // ── Approval Workflow ─────────────────────────────────────────────────────

  private async createNotification(userId: string, type: string, title: string, body: string, relatedEntityId: string) {
    return this.prisma.notification.create({
      data: {
        userId,
        type,
        title,
        body,
        channel: 'in_app',
        status: 'pending',
        relatedEntityType: 'repair_report',
        relatedEntityId,
      },
    });
  }

  private async getApprovers(): Promise<Array<{ id: string; expoPushToken: string | null }>> {
    // Users with admin or ops_manager role
    return this.prisma.user.findMany({
      where: {
        status: 'active',
        role: { code: { in: ['admin', 'ops_manager', 'manager'] } },
      },
      select: { id: true, expoPushToken: true },
    });
  }

  async requestApproval(reportId: string, userId: string) {
    const report = await this.prisma.repairReport.findUnique({
      where: { id: reportId },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        items: { select: { salesTotal: true, supplierTotal: true, lumpSumPrice: true, pricingType: true } },
      },
    });
    if (!report) throw new NotFoundException('Rapor bulunamadı');
    if (report.status !== 'draft' && report.status !== 'rejected') {
      throw new BadRequestException('Yalnızca taslak veya reddedilmiş raporlar onaya gönderilebilir');
    }

    if (!report.findingsText?.trim()) {
      throw new BadRequestException('Tespit Bulguları doldurulmadan onaya gönderilemez.');
    }
    if (report.items.length === 0) {
      throw new BadRequestException('En az bir onarım kalemi eklenmeden onaya gönderilemez.');
    }
    const totalSales = report.items.reduce((sum, item) => sum + Number(item.salesTotal ?? 0), 0);
    const totalCost = report.items.reduce((sum, item) => sum + Number(item.supplierTotal ?? 0), 0);
    const totalLumpSum = report.items.reduce((sum, item) => {
      if (item.pricingType === 'lumpsum') return sum + Number(item.lumpSumPrice ?? 0);
      return sum;
    }, 0);
    if (totalSales <= 0 && totalCost <= 0 && totalLumpSum <= 0) {
      throw new BadRequestException('Maliyet veya satış tutarı girilmeden onaya gönderilemez.');
    }

    // Onaya gönderilmeden önce anomali analizi yap (non-blocking)
    void this.triggerAnomalyAnalysisOnly(reportId);

    await this.prisma.repairReport.update({
      where: { id: reportId },
      data: { status: 'pending_approval' },
    });

    await this.prisma.reportApprovalHistory.create({
      data: { reportId, userId, action: 'pending_approval' },
    });

    await this.syncClaimFromLatestReport(report.claimFileId);

    // Notify approvers
    const approvers = await this.getApprovers();
    for (const approver of approvers) {
      if (approver.id !== userId) {
        await this.createNotification(
          approver.id,
          'report_approval_requested',
          'Onay Bekleyen Rapor',
          `${report.reportNo} numaralı rapor onayınızı bekliyor.`,
          reportId,
        );
      }
    }

    return this.getReport(reportId);
  }

  async approveReport(reportId: string, userId: string, reason?: string) {
    const report = await this.prisma.repairReport.findUnique({
      where: { id: reportId },
      include: {
        createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        claimFile: {
          select: {
            id: true,
            fileNo: true,
            insuranceCompanyId: true,
            insuranceCompany: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!report) throw new NotFoundException('Rapor bulunamadı');
    if (report.status !== 'pending_approval') {
      throw new BadRequestException('Yalnızca onay bekleyen raporlar onaylanabilir');
    }

    await this.prisma.repairReport.update({
      where: { id: reportId },
      data: { status: 'approved' },
    });

    const approver = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });

    const trimmedReason = reason?.trim() || null;
    await this.prisma.reportApprovalHistory.create({
      data: { reportId, userId, action: 'approved', reason: trimmedReason },
    });

    // Notify report creator (in-app)
    await this.createNotification(
      report.createdByUserId,
      'report_approved',
      'Raporunuz Onaylandı',
      `${report.reportNo} numaralı raporunuz onaylandı.`,
      reportId,
    );

    // Email bildirimi
    if (this.claimEventEmail && (report.createdBy as any)?.email) {
      void this.claimEventEmail.onReportApproved({
        recipientEmail: (report.createdBy as any).email,
        recipientUserId: report.createdByUserId,
        reportNo: report.reportNo,
        fileNo: (report.claimFile as any)?.fileNo ?? '',
        approvedBy: approver ? `${approver.firstName} ${approver.lastName}` : '',
        claimFileId: report.claimFileId,
        reportId,
      });
    }

    // Tedarikçi risk ve anomali analizi (async, non-blocking)
    void this.triggerRiskAnalysis(reportId, report.claimFileId);

    if (report.claimFile?.insuranceCompanyId) {
      try {
        await this.externalApprovals.ensureInsurancePortalApproval(
          reportId,
          userId,
          report.claimFile.insuranceCompanyId,
          report.claimFile.insuranceCompany?.name ?? 'Sigorta Şirketi',
        );
      } catch (err) {
        this.logger.warn(`Sigorta portalı otomatik onay kaydı oluşturulamadı: ${reportId}`, err);
      }
    }

    await this.syncClaimFromLatestReport(report.claimFileId);

    return this.getReport(reportId);
  }

  async rejectReport(reportId: string, userId: string, reason: string) {
    const report = await this.prisma.repairReport.findUnique({
      where: { id: reportId },
      include: {
        createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        claimFile: { select: { id: true, fileNo: true } },
      },
    });
    if (!report) throw new NotFoundException('Rapor bulunamadı');
    if (report.status !== 'pending_approval') {
      throw new BadRequestException('Yalnızca onay bekleyen raporlar reddedilebilir');
    }

    await this.prisma.repairReport.update({
      where: { id: reportId },
      data: { status: 'rejected' },
    });

    await this.prisma.reportApprovalHistory.create({
      data: { reportId, userId, action: 'rejected', reason },
    });

    // Notify report creator (in-app)
    await this.createNotification(
      report.createdByUserId,
      'report_rejected',
      'Raporunuz Reddedildi',
      `${report.reportNo} numaralı raporunuz reddedildi. Neden: ${reason || 'Belirtilmemiş'}`,
      reportId,
    );

    // Email bildirimi
    if (this.claimEventEmail && (report.createdBy as any)?.email) {
      void this.claimEventEmail.onReportRejected({
        recipientEmail: (report.createdBy as any).email,
        recipientUserId: report.createdByUserId,
        reportNo: report.reportNo,
        fileNo: (report.claimFile as any)?.fileNo ?? '',
        rejectionReason: reason || 'Belirtilmemiş',
        claimFileId: report.claimFileId,
        reportId,
      });
    }

    await this.syncClaimFromLatestReport(report.claimFileId);

    await this.supersedeOpenWritingReports(
      report.claimFileId,
      userId,
      reason,
      reportId,
    );

    return this.getReport(reportId);
  }

  /**
   * Manuel red / rapor reddi sonrası aynı dosyadaki taslak ve gönderilmiş
   * raporları «rejected» yapar. Onaylı rapora dokunmaz.
   */
  async supersedeOpenWritingReports(
    claimFileId: string,
    userId: string,
    reason: string,
    exceptReportId?: string | null,
  ): Promise<string[]> {
    const rows = await this.prisma.repairReport.findMany({
      where: {
        claimFileId,
        status: { in: [...OPEN_WRITING_REPORT_STATUSES] },
        ...(exceptReportId ? { id: { not: exceptReportId } } : {}),
      },
      select: { id: true },
    });
    for (const row of rows) {
      await this.prisma.repairReport.update({
        where: { id: row.id },
        data: { status: 'rejected' },
      });
      await this.prisma.reportApprovalHistory.create({
        data: {
          reportId: row.id,
          userId,
          action: 'rejected',
          reason,
        },
      });
    }
    return rows.map((row) => row.id);
  }

  async getApprovalHistory(reportId: string) {
    const report = await this.prisma.repairReport.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Rapor bulunamadı');

    const data = await this.prisma.reportApprovalHistory.findMany({
      where: { reportId },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'asc' },
    });

    return { data };
  }

  // ── Revizyon ──────────────────────────────────────────────────────────────

  async reviseReport(
    reportId: string,
    userId: string,
    options?: {
      reason?: string;
      reasonNote?: string;
      affectedSections?: string[];
      /** Sözlü manuel revizyon: onay bekleyen rapordan da revizyon taslağı açılabilir */
      allowPendingVerbal?: boolean;
    },
  ) {
    const report = await this.prisma.repairReport.findUnique({
      where: { id: reportId },
      include: {
        items: { include: { damageType: true } },
        images: true,
        damageTypes: true,
      },
    });
    if (!report) throw new NotFoundException('Rapor bulunamadı');
    if (!canStartRepairReportRevisionFromStatus(report.status)) {
      throw new BadRequestException('Bu rapor durumunda revizyon başlatılamaz');
    }

    // Zincirin kök id'sini bul
    const originalId = report.originalReportId ?? report.id;

    // Mevcut açık (draft/rejected) revizyon var mı kontrol et
    const existingDraft = await this.prisma.repairReport.findFirst({
      where: {
        originalReportId: originalId,
        status: { in: ['draft', 'rejected', 'pending_approval'] },
      },
    });
    if (existingDraft) {
      throw new BadRequestException('Bu rapor için zaten açık bir revizyon mevcut');
    }

    // En yüksek versionNo'yu bul (0..3; 4. revizyon yok)
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

    // Yeni reportNo: temel numara + "-R" + yeni versiyon
    const baseReportNo = report.reportNo.replace(/-R\d+$/, '');
    const newReportNo = `${baseReportNo}-R${newVersionNo}`;

    return this.prisma.$transaction(async (tx) => {
      // Yeni raporu oluştur
      const newReport = await tx.repairReport.create({
        data: {
          claimFileId: report.claimFileId,
          reportNo: newReportNo,
          reportType: report.reportType,
          reportDate: report.reportDate,
          inspectorName: report.inspectorName,
          reporterName: report.reporterName,
          findingsText: report.findingsText,
          legalNotes: report.legalNotes,
          departmentId: report.departmentId,
          buildingDamageTotal: report.buildingDamageTotal,
          goodsDamageTotal: report.goodsDamageTotal,
          totalSupplierCost: report.totalSupplierCost,
          totalSalesAmount: report.totalSalesAmount,
          grossProfit: report.grossProfit,
          grossMarginPct: report.grossMarginPct,
          status: 'draft',
          versionNo: newVersionNo,
          originalReportId: originalId,
          revisedAt: new Date(),
          revisedByUserId: userId,
          createdByUserId: userId,
        },
      });

      // DamageType'ları kopyala; id eşlemesini sakla
      const dtIdMap = new Map<string, string>();
      for (const dt of report.damageTypes) {
        const newDt = await tx.reportDamageType.create({
          data: {
            reportId: newReport.id,
            damageTypeCode: dt.damageTypeCode,
            damageTypeName: dt.damageTypeName,
            sortOrder: dt.sortOrder,
          },
        });
        dtIdMap.set(dt.id, newDt.id);
      }

      // Item'ları kopyala
      for (const item of report.items) {
        await tx.repairReportItem.create({
          data: {
            reportId: newReport.id,
            workGroupId: item.workGroupId,
            damageTypeId: item.damageTypeId ? (dtIdMap.get(item.damageTypeId) ?? null) : null,
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
            damageCategory: item.damageCategory ?? 'bina',
          },
        });
      }

      // Image'ları kopyala (aynı storage key — dosyalar değişmiyor)
      for (const img of report.images) {
        await tx.reportImage.create({
          data: {
            reportId: newReport.id,
            storageKey: img.storageKey,
            annotatedKey: img.annotatedKey,
            fileName: img.fileName,
            mimeType: img.mimeType,
            fileSize: img.fileSize,
            category: img.category,
            caption: img.caption,
            hasAnnotation: img.hasAnnotation,
            annotationData: img.annotationData ?? undefined,
            sortOrder: img.sortOrder,
          },
        });
      }

      // ApprovalHistory kaydı
      const sectionNote = options?.affectedSections?.length
        ? ` · Bölümler: ${options.affectedSections.join(', ')}`
        : '';
      const reasonDetail = options?.reasonNote?.trim()
        ? `${options.reasonNote.trim()}${sectionNote}`
        : `v${report.versionNo} üzerinden revizyon oluşturuldu${sectionNote}`;
      await tx.reportApprovalHistory.create({
        data: {
          reportId: newReport.id,
          userId,
          action: 'revision_created',
          reason: reasonDetail,
        },
      });

      // Onay bekleyen kaynaktan revizyon: eski bekleyen kaydı kapat, tek aktif taslak kalsın
      if (repairReportClosesOnRevise(report.status)) {
        await tx.repairReport.update({
          where: { id: report.id },
          data: { status: 'rejected' },
        });
        await tx.reportApprovalHistory.create({
          data: {
            reportId: report.id,
            userId,
            action: 'rejected',
            reason: options?.reasonNote?.trim() || 'Revizyon başlatıldı — yeni taslak açıldı',
          },
        });
        await tx.externalApproval.updateMany({
          where: { reportId: report.id, status: 'pending' },
          data: { status: 'expired' },
        });
      }

      if (options?.reason && options?.reasonNote?.trim()) {
        await tx.reportRevisionRequest.create({
          data: {
            reportId: report.id,
            requestedById: userId,
            status: 'IN_PROGRESS',
            priority: 'NORMAL',
            reason: options.reason as any,
            reasonNote: options.reasonNote.trim(),
            affectedItems: options.affectedSections ?? [],
            newReportId: newReport.id,
          },
        });
      }

      // getReport() bu transaction dışından okursa READ COMMITTED nedeniyle 404 alır
      // — doğrudan tx client ile sorgula
      let created;
      try {
        created = await tx.repairReport.findUnique({
          where: { id: newReport.id },
          include: REPORT_INCLUDE,
        });
      } catch (error) {
        if (!isMissingAssignedInspectorVendorColumn(error)) throw error;
        created = await tx.repairReport.findUnique({
          where: { id: newReport.id },
          include: REPORT_INCLUDE_SAFE,
        });
      }
      if (!created) throw new NotFoundException('Revizyon raporu oluşturulamadı');
      return created;
    });
  }

  async getVersions(reportId: string) {
    const report = await this.prisma.repairReport.findUnique({
      where: { id: reportId },
      select: { id: true, originalReportId: true },
    });
    if (!report) throw new NotFoundException('Rapor bulunamadı');

    const originalId = report.originalReportId ?? report.id;

    const versions = await this.prisma.repairReport.findMany({
      where: {
        OR: [{ id: originalId }, { originalReportId: originalId }],
      },
      select: {
        id: true,
        reportNo: true,
        versionNo: true,
        status: true,
        createdAt: true,
        revisedAt: true,
        totalSalesAmount: true,
        grossMarginPct: true,
        revisedBy: { select: { id: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { items: true } },
      },
      orderBy: { versionNo: 'asc' },
    });

    return { data: versions };
  }

  // ── Diff / Karşılaştırma ──────────────────────────────────────────────────

  async diffReports(reportAId: string, reportBId: string) {
    const [reportA, reportB] = await Promise.all([
      this.prisma.repairReport.findUnique({
        where: { id: reportAId },
        include: { items: { include: { workGroup: true } } },
      }),
      this.prisma.repairReport.findUnique({
        where: { id: reportBId },
        include: { items: { include: { workGroup: true } } },
      }),
    ]);

    if (!reportA) throw new NotFoundException(`Rapor bulunamadı: ${reportAId}`);
    if (!reportB) throw new NotFoundException(`Rapor bulunamadı: ${reportBId}`);

    const mapByDescription = (items: typeof reportA.items) => {
      const map = new Map<string, (typeof items)[number]>();
      for (const item of items) {
        map.set(item.jobDescription, item);
      }
      return map;
    };

    const mapA = mapByDescription(reportA.items);
    const mapB = mapByDescription(reportB.items);

    const allKeys = new Set([...mapA.keys(), ...mapB.keys()]);

    const added: object[] = [];
    const removed: object[] = [];
    const changed: object[] = [];
    const unchanged: object[] = [];

    for (const key of allKeys) {
      const itemA = mapA.get(key);
      const itemB = mapB.get(key);

      if (!itemA && itemB) {
        added.push({
          jobDescription: itemB.jobDescription,
          workGroup: itemB.workGroup?.name,
          quantity: itemB.quantity,
          unit: itemB.unit,
          salesUnitPrice: itemB.salesUnitPrice,
          salesTotal: itemB.salesTotal,
        });
      } else if (itemA && !itemB) {
        removed.push({
          jobDescription: itemA.jobDescription,
          workGroup: itemA.workGroup?.name,
          quantity: itemA.quantity,
          unit: itemA.unit,
          salesUnitPrice: itemA.salesUnitPrice,
          salesTotal: itemA.salesTotal,
        });
      } else if (itemA && itemB) {
        const fields: Record<string, { before: unknown; after: unknown }> = {};
        let hasChanges = false;

        if (itemA.quantity !== itemB.quantity) {
          fields.quantity = { before: itemA.quantity, after: itemB.quantity };
          hasChanges = true;
        }
        if (itemA.salesUnitPrice !== itemB.salesUnitPrice) {
          fields.salesUnitPrice = { before: itemA.salesUnitPrice, after: itemB.salesUnitPrice };
          hasChanges = true;
        }
        if (itemA.salesTotal !== itemB.salesTotal) {
          fields.salesTotal = { before: itemA.salesTotal, after: itemB.salesTotal };
          hasChanges = true;
        }
        if (itemA.supplierUnitPrice !== itemB.supplierUnitPrice) {
          fields.supplierUnitPrice = { before: itemA.supplierUnitPrice, after: itemB.supplierUnitPrice };
          hasChanges = true;
        }
        if (itemA.unit !== itemB.unit) {
          fields.unit = { before: itemA.unit, after: itemB.unit };
          hasChanges = true;
        }

        if (hasChanges) {
          changed.push({
            jobDescription: itemA.jobDescription,
            workGroup: itemA.workGroup?.name,
            changes: fields,
          });
        } else {
          unchanged.push({ jobDescription: itemA.jobDescription });
        }
      }
    }

    const priceDiff = reportB.totalSalesAmount - reportA.totalSalesAmount;

    return {
      data: {
        reportA: {
          id: reportA.id,
          reportNo: reportA.reportNo,
          versionNo: reportA.versionNo,
          totalSalesAmount: reportA.totalSalesAmount,
          status: reportA.status,
        },
        reportB: {
          id: reportB.id,
          reportNo: reportB.reportNo,
          versionNo: reportB.versionNo,
          totalSalesAmount: reportB.totalSalesAmount,
          status: reportB.status,
        },
        summary: {
          addedCount: added.length,
          removedCount: removed.length,
          changedCount: changed.length,
          unchangedCount: unchanged.length,
          priceDiff,
          priceDiffPct:
            reportA.totalSalesAmount !== 0
              ? (priceDiff / reportA.totalSalesAmount) * 100
              : null,
        },
        added,
        removed,
        changed,
        unchanged,
      },
    };
  }

  // ─── Risk & Anomali Yardımcı Metodlar ───────────────────────────────────

  private async triggerAnomalyAnalysisOnly(reportId: string): Promise<void> {
    if (!this.anomalyDetection) return;
    try {
      await this.anomalyDetection.analyzeReport(reportId);
    } catch (err) {
      this.logger.error(`Anomaly analysis failed for report ${reportId}: ${err}`);
    }
  }

  private async triggerRiskAnalysis(reportId: string, claimFileId: string): Promise<void> {
    try {
      // Anomali analizi
      if (this.anomalyDetection) {
        await this.anomalyDetection.analyzeReport(reportId);
      }

      // Tedarikçi risk skoru güncelle
      if (this.vendorRisk) {
        const costEntry = await this.prisma.costEntry.findFirst({
          where: { claimFileId, vendorId: { not: null } },
          select: { vendorId: true },
        });
        if (costEntry?.vendorId) {
          await this.vendorRisk.recalculateAndSave(costEntry.vendorId);
        }
      }
    } catch (err) {
      this.logger.error(`Risk analysis failed for report ${reportId}: ${err}`);
    }
  }

  // ─── Rapor Yazım Süresi Analitiği (madde 39) ─────────────────────────────

  async upsertWriteSession(
    reportId: string,
    userId: string,
    payload: { startedAt: string; claimFileId?: string },
  ) {
    const report = await this.prisma.repairReport.findUnique({
      where: { id: reportId },
      select: { id: true, claimFileId: true },
    });
    if (!report) throw new NotFoundException('Rapor bulunamadı');

    const startedAt = new Date(payload.startedAt);
    const open = await this.prisma.reportWriteSession.findFirst({
      where: { reportId, userId, endedAt: null },
      orderBy: { startedAt: 'desc' },
    });

    if (open) {
      return this.prisma.reportWriteSession.update({
        where: { id: open.id },
        data: { startedAt },
      });
    }

    return this.prisma.reportWriteSession.create({
      data: {
        userId,
        reportId,
        claimFileId: payload.claimFileId ?? report.claimFileId,
        startedAt,
      },
    });
  }

  async closeWriteSession(reportId: string, userId: string, endedAt?: string) {
    const open = await this.prisma.reportWriteSession.findFirst({
      where: { reportId, userId, endedAt: null },
      orderBy: { startedAt: 'desc' },
    });
    if (!open) return null;

    const end = endedAt ? new Date(endedAt) : new Date();
    const durationSec = Math.max(0, Math.floor((end.getTime() - open.startedAt.getTime()) / 1000));

    return this.prisma.reportWriteSession.update({
      where: { id: open.id },
      data: { endedAt: end, durationSec },
    });
  }

  async getWriteAnalytics(query: { days?: number }) {
    const days = query.days && query.days > 0 ? query.days : 30;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const sessions = await this.prisma.reportWriteSession.findMany({
      where: {
        startedAt: { gte: since },
        durationSec: { not: null },
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        report: { select: { id: true, reportNo: true, claimFileId: true } },
      },
      orderBy: { startedAt: 'desc' },
      take: 500,
    });

    const byUser = new Map<string, {
      userId: string;
      firstName: string;
      lastName: string;
      email: string;
      sessionCount: number;
      totalDurationSec: number;
      avgDurationSec: number;
      lastSessionAt: string;
    }>();

    for (const s of sessions) {
      const key = s.userId;
      const existing = byUser.get(key);
      const dur = s.durationSec ?? 0;
      if (!existing) {
        byUser.set(key, {
          userId: s.userId,
          firstName: s.user.firstName,
          lastName: s.user.lastName,
          email: s.user.email,
          sessionCount: 1,
          totalDurationSec: dur,
          avgDurationSec: dur,
          lastSessionAt: s.startedAt.toISOString(),
        });
      } else {
        existing.sessionCount += 1;
        existing.totalDurationSec += dur;
        existing.avgDurationSec = Math.round(existing.totalDurationSec / existing.sessionCount);
        if (s.startedAt.toISOString() > existing.lastSessionAt) {
          existing.lastSessionAt = s.startedAt.toISOString();
        }
      }
    }

    return {
      days,
      sessions: sessions.map((s) => ({
        id: s.id,
        userId: s.userId,
        userName: `${s.user.firstName} ${s.user.lastName}`.trim(),
        reportId: s.reportId,
        reportNo: s.report.reportNo,
        claimFileId: s.claimFileId,
        startedAt: s.startedAt,
        endedAt: s.endedAt,
        durationSec: s.durationSec,
      })),
      byUser: Array.from(byUser.values()).sort((a, b) => b.totalDurationSec - a.totalDurationSec),
    };
  }
}
