import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Optional,
  Logger,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { PrismaService } from '@/prisma/prisma.service';
import { InvoiceRequestsService } from '@/modules/invoice-requests/invoice-requests.service';
import { ConfigService } from '@nestjs/config';
import { buildAppPath, resolveAppUrl } from '@/common/utils/app-url';
import { buildPanelUrl, panelHasarDosyasiPath } from '@/common/utils/panel-url';
import { buildWhatsAppMeUrl } from '@/common/utils/whatsapp-phone';
import { ReportPdfService } from './pdf/report-pdf.service';
import { ReportEmailService } from './email/report-email.service';
import {
  approvalRecipientSurname,
  reportMailSignature,
} from './email/report-dispatch-email.template';
import { ClaimEventEmailService } from '@/modules/notifications/email/claim-event-email.service';
import { AnomalyDetectionService } from '@/modules/vendor-risk/anomaly-detection.service';
import { VendorRiskService } from '@/modules/vendor-risk/vendor-risk.service';
import { DamageRepairTemplatesService } from '@/modules/damage-repair-templates/damage-repair-templates.service';
import {
  linkOpenExtraRepairToReport,
  markExtraRepairApprovedForReport,
} from '@/modules/finance/hasar-extra-repair-link';
import { ExternalApprovalsService } from '@/modules/external-approvals/external-approvals.service';
import { normalizeReportImageCategory } from './report-image-category';
import { getReportImagesDir, resolveReportImageFilePath, type PdfImageFit } from './report-image-paths';
import { StorageService } from '@/modules/storage/storage.service';
import { resolveReportCustomerMailRecipients } from './report-customer-mail-recipients';
import {
  buildPlatformMailCopyNotice,
  collectClaimFileChannelEmails,
  customerContactCopyEmails,
  buildClaimApprovalMailSubject,
  claimApprovalCustomerDisplayName,
  filterSelectedApprovalEmails,
  generalMailboxesFromContactInfos,
  mergeApprovalMailCc,
  resolveApprovalFileOwnerCc,
  resolveApprovalInformCc,
  resolveClaimMailRoute,
  splitClaimApprovalMessageText,
} from '@sigorta/shared';
import { serviceMailRouteForClaim } from '@/common/hizmet-karti-store';
import { isMeridyenInternalMailbox } from '@/modules/notifications/email/file-closure-email.template';
import {
  ACIL_INSPECTION_PHOTO_NOTE,
  isHasarTespitPhotoNotes,
  claimApprovalExpertParty,
  isExpertFirmCustomer,
  repairReportRequiresPricedItems,
  isInspectionServiceKind,
  hasarReportDocumentTitle,
  EXTRA_REPAIR_KIND,
  partitionExtraRepairCostItems,
  REPAIR_REPORT_INITIAL_VERSION,
  REPAIR_REPORT_MAX_REVISION_MESSAGE,
  canCreateRepairReportRevision,
  canStartRepairReportRevisionFromStatus,
  nextRepairReportVersionNo,
  repairReportClosesOnRevise,
  repairItemSalesTotal,
  repairItemSupplierTotal,
  repairItemMarginPct,
  repairItemSupplierNeedsHeal,
  repairItemResolvedSupplierTotal,
  claimFileReportGrandTotal,
  maliMesuliyetAlanToplami,
  internalRepairPdfFilename,
  packInlineMailAttachments,
  REPAIR_REPORT_MAIL_INLINE_MAX_BYTES,
} from '@sigorta/shared';
import {
  CreateRepairReportDto,
  UpdateRepairReportDto,
  CreateReportItemDto,
  UpdateReportItemDto,
  CreateDamageTypeDto,
  SendEmailDto,
  AddQuickRepairItemsDto,
  RequestApprovalDto,
} from './dto/repair-reports.dto';
import * as fs from 'fs';
import * as path from 'path';
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
  channelAgencyCustomer: {
    select: {
      id: true, companyName: true, shortName: true, fullName: true, firstName: true, lastName: true, email: true,
      contacts: { select: { id: true, name: true, email: true, isPrimary: true } },
      contactInfos: { select: { type: true, label: true, value: true } },
    },
  },
  channelBrokerCustomer: {
    select: {
      id: true, companyName: true, shortName: true, fullName: true, firstName: true, lastName: true, email: true,
      contacts: { select: { id: true, name: true, email: true, isPrimary: true } },
      contactInfos: { select: { type: true, label: true, value: true } },
    },
  },
  channelExpertCustomer: {
    select: {
      id: true, companyName: true, shortName: true, fullName: true, firstName: true, lastName: true, email: true,
      contacts: { select: { id: true, name: true, email: true, isPrimary: true } },
      contactInfos: { select: { type: true, label: true, value: true } },
    },
  },
  propertyAddress: true,
  notificationDate: true,
  serviceKind: true,
  mailRouteJson: true,
  consultancyServiceType: { select: { id: true, code: true, name: true } },
  claimSubject: { select: { id: true, code: true, name: true } },
  assignedFieldUser: { select: { id: true, firstName: true, lastName: true, phone: true } },
  assignedOfficeUser: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
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
    @Optional() private readonly storage?: StorageService,
    @Optional() private readonly moduleRef?: ModuleRef,
  ) {}

  /** Hasar Tespit: rapor müşteriye gidince hizmet bedeliyle satış fatura talebi; bedel yoksa dosyaya not düşer. */
  private async ensureHasarTespitInvoiceRequest(claimFileId: string, userId: string): Promise<void> {
    try {
      const requests = this.moduleRef?.get(InvoiceRequestsService, { strict: false });
      if (!requests) return;
      const result = await requests.ensureHasarTespitInvoiceRequest(claimFileId, userId);
      if (result.created || result.reason === 'fee_missing') {
        await this.prisma.fileActivityLog.create({
          data: {
            claimFileId,
            action: 'NOTE_ADDED' as any,
            actorId: userId,
            actorRole: 'office_staff',
            description: result.created
              ? 'Hasar Tespit Hizmet Bedeli için satış fatura talebi finansa gitti.'
              : 'Rapor müşteriye gitti. Fatura talebi için Finans → Gelir’e Hasar Tespit Hizmet Bedeli girin.',
            metadata: { kind: 'hasar_tespit_invoice_request', created: result.created, reason: result.reason ?? null },
          },
        }).catch(() => undefined);
      }
    } catch (err) {
      this.logger.warn(`Hasar Tespit fatura talebi (${claimFileId}): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // ── Reports ─────────────────────────────────────────────────────────────────

  async getReportsByClaimFile(claimFileId: string) {
    const claimFile = await this.prisma.claimFile.findUnique({ where: { id: claimFileId } });
    if (!claimFile) throw new NotFoundException('Hasar dosyası bulunamadı');
    const reports = await this.prisma.repairReport.findMany({
      where: { claimFileId },
      select: { id: true },
    });
    for (const report of reports) {
      await this.healInflatedSupplierTotals(report.id);
    }
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

    const created = await this.mutateReportWithInclude('create', {
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
    await linkOpenExtraRepairToReport(this.prisma, claimFileId, created.id);
    await this.attachClaimInspectionPhotosToReport(created.id, claimFileId);
    return this.findReportWithInclude(created.id) ?? created;
  }

  async getReport(id: string) {
    await this.healInflatedSupplierTotals(id);
    const loaded = await this.findReportWithInclude(id);
    if (!loaded) throw new NotFoundException('Rapor bulunamadı');
    await this.attachClaimInspectionPhotosToReport(loaded.id, loaded.claimFileId);
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
      return this.attachExtraRepairCostLayout(
        this.overlayReportItemMoney({ ...report, inspectorName: vendorName }),
      );
    }

    return this.attachExtraRepairCostLayout(this.overlayReportItemMoney(report));
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

    let damageTypeId = dto.damageTypeId;
    if (report.reportType === 'multi' && !damageTypeId) {
      const types = await this.prisma.reportDamageType.findMany({
        where: { reportId },
        orderBy: { sortOrder: 'asc' },
      });
      if (types.length === 1) damageTypeId = types[0].id;
      else {
        throw new BadRequestException('Çok hasarlı raporda kalem için hasar nedeni zorunludur');
      }
    }

    const pricingType = dto.pricingType ?? 'unit';
    const lumpSumPrice = dto.lumpSumPrice;
    let supplierTotal: number;
    let salesTotal: number;

    if (pricingType === 'lumpsum' && lumpSumPrice != null) {
      supplierTotal = lumpSumPrice;
      salesTotal = lumpSumPrice;
    } else {
      const priced = {
        pricingType,
        lumpSumPrice,
        quantity: dto.quantity,
        salesUnitPrice: dto.salesUnitPrice,
        supplierUnitPrice: dto.supplierUnitPrice,
      };
      supplierTotal = repairItemSupplierTotal(priced);
      salesTotal = repairItemSalesTotal(priced);
    }
    const marginPct = repairItemMarginPct({
      pricingType,
      lumpSumPrice,
      quantity: dto.quantity,
      salesUnitPrice: dto.salesUnitPrice,
      supplierUnitPrice: dto.supplierUnitPrice,
    });

    const item = await this.prisma.repairReportItem.create({
      data: {
        reportId,
        workGroupId: dto.workGroupId,
        damageTypeId,
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
      const lineCost = quantity * unitPrice;
      const priced = { quantity, supplierUnitPrice: lineCost, salesUnitPrice: unitPrice };
      const createdItem = await this.prisma.repairReportItem.create({
        data: {
          reportId,
          workGroupId: subGroup.workGroupId,
          damageTypeId: defaultDamageTypeId,
          jobDescription: subGroup.name,
          description: item.note,
          quantity,
          unit: subGroup.unitType,
          supplierUnitPrice: lineCost,
          salesUnitPrice: unitPrice,
          supplierTotal: repairItemSupplierTotal(priced),
          salesTotal: repairItemSalesTotal(priced),
          marginPct: repairItemMarginPct(priced),
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

    const supplierOnly = dto.supplierTotal != null
      && dto.salesUnitPrice === undefined
      && dto.lumpSumPrice === undefined
      && dto.pricingType === undefined
      && dto.supplierUnitPrice === undefined
      && dto.quantity === undefined;

    if (supplierOnly) {
      const nextSupplier = Math.round(Number(dto.supplierTotal) * 100) / 100;
      if (!(nextSupplier >= 0)) throw new BadRequestException('Tedarikçi fiyatı girin.');
      const updated = await this.prisma.repairReportItem.update({
        where: { id: itemId },
        data: {
          supplierTotal: nextSupplier,
          supplierUnitPrice: item.pricingType === 'lumpsum' ? item.supplierUnitPrice : nextSupplier,
          marginPct: repairItemMarginPct({
            pricingType: item.pricingType,
            lumpSumPrice: item.lumpSumPrice,
            quantity: item.quantity,
            salesUnitPrice: item.salesUnitPrice,
            supplierUnitPrice: item.pricingType === 'lumpsum' ? item.supplierUnitPrice : nextSupplier,
            supplierTotal: nextSupplier,
          }),
        },
        include: { workGroup: true, damageType: true },
      });
      await this.recalculateTotals(item.reportId);
      return updated;
    }

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
      const priced = {
        pricingType,
        lumpSumPrice,
        quantity,
        salesUnitPrice,
        supplierUnitPrice,
      };
      supplierTotal = repairItemSupplierTotal(priced);
      salesTotal = repairItemSalesTotal(priced);
    }
    const marginPct = repairItemMarginPct({
      pricingType,
      lumpSumPrice,
      quantity,
      salesUnitPrice,
      supplierUnitPrice,
    });

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

  /** Eski maliyet = miktar × girilen rakam kayıtlarını satır maliyetine çeker. */
  private async healInflatedSupplierTotals(reportId: string): Promise<number> {
    const items = await this.prisma.repairReportItem.findMany({ where: { reportId } });
    const inflated = items.filter((item) => repairItemSupplierNeedsHeal(item));
    if (inflated.length === 0) return 0;
    for (const item of inflated) {
      await this.prisma.repairReportItem.update({
        where: { id: item.id },
        data: {
          supplierTotal: repairItemSupplierTotal(item),
          salesTotal: repairItemSalesTotal(item),
          marginPct: repairItemMarginPct(item),
        },
      });
    }
    await this.recalculateTotals(reportId);
    this.logger.warn(`Onarım raporu maliyet m² düzeltmesi: ${inflated.length} kalem (${reportId})`);
    return inflated.length;
  }

  private overlayReportItemMoney<T extends {
    items?: Array<{
      pricingType?: string | null;
      lumpSumPrice?: number | null;
      quantity?: number | null;
      salesUnitPrice?: number | null;
      supplierUnitPrice?: number | null;
      damageCategory?: string | null;
    }>;
  }>(report: T): T & {
    items: T['items'];
    totalSupplierCost: number;
    totalSalesAmount: number;
    grossProfit: number;
    grossMarginPct: number;
  } {
    const items = (report.items ?? []).map((item) => ({
      ...item,
      supplierTotal: repairItemResolvedSupplierTotal(item),
      salesTotal: repairItemSalesTotal(item),
      marginPct: repairItemMarginPct(item),
    }));
    const totalSupplierCost = items.reduce((s, i) => s + i.supplierTotal, 0);
    const totalSalesAmount = items.reduce((s, i) => s + i.salesTotal, 0);
    const grossProfit = totalSalesAmount - totalSupplierCost;
    const grossMarginPct = totalSalesAmount > 0 ? (grossProfit / totalSalesAmount) * 100 : 0;
    return { ...report, items, totalSupplierCost, totalSalesAmount, grossProfit, grossMarginPct };
  }

  private async attachExtraRepairCostLayout<T extends {
    id: string;
    claimFileId: string;
    originalReportId?: string | null;
    items?: Array<{
      id?: string | null;
      workGroup?: { name?: string | null } | null;
      workGroupId?: string | null;
      jobDescription?: string | null;
    }>;
  }>(report: T): Promise<T & {
    extraReportAlone: boolean;
    originalCostItems: NonNullable<T['items']>;
    items: Array<NonNullable<T['items']>[number] & { extraRepairCost: boolean }>;
  }> {
    const extraLink = await this.prisma.extraWorkItem.findFirst({
      where: { repairReportId: report.id, kind: EXTRA_REPAIR_KIND },
      select: { id: true },
    });
    let originalItems: NonNullable<T['items']> = [] as NonNullable<T['items']>;
    if (report.originalReportId) {
      originalItems = await this.prisma.repairReportItem.findMany({
        where: { reportId: report.originalReportId },
        include: { workGroup: true, damageType: true },
      }) as NonNullable<T['items']>;
    } else if (extraLink) {
      const base = await this.prisma.repairReport.findFirst({
        where: {
          claimFileId: report.claimFileId,
          id: { not: report.id },
          status: { in: ['approved', 'externally_approved'] },
        },
        orderBy: { createdAt: 'asc' },
        include: {
          items: {
            include: { workGroup: true, damageType: true },
            orderBy: [{ workGroup: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
          },
        },
      });
      originalItems = (base?.items ?? []) as NonNullable<T['items']>;
    }
    const extraReportAlone = Boolean(extraLink) && !report.originalReportId;
    const split = partitionExtraRepairCostItems({
      currentItems: report.items ?? [],
      originalItems,
      extraReportAlone,
    });
    const extraIds = new Set(split.extraItems.map((row) => String(row.id ?? '')));
    const items = (report.items ?? []).map((item) => ({
      ...item,
      extraRepairCost: extraIds.has(String(item.id ?? '')),
    }));
    return {
      ...report,
      items,
      extraReportAlone,
      originalCostItems: extraReportAlone ? originalItems : split.originalItems,
    };
  }

  private async recalculateTotals(reportId: string) {
    const items = await this.prisma.repairReportItem.findMany({ where: { reportId } });
    const reportRow = await this.prisma.repairReport.findUnique({
      where: { id: reportId },
      select: { claimFileId: true },
    });
    const unlinkedNeighbor = reportRow
      ? await this.prisma.maliMesuliyetIsKalemi.findMany({
          where: {
            tespit: { claimFileId: reportRow.claimFileId },
            repairReportItemId: null,
          },
        })
      : [];
    const mainItems = items.filter((item) => !item.maliMesuliyetTespitId);
    const taggedNeighbor = items.filter((item) => item.maliMesuliyetTespitId);
    const grand = claimFileReportGrandTotal({
      mainReportItems: mainItems,
      neighborItems: [...taggedNeighbor, ...unlinkedNeighbor],
    });
    const totalSupplierCost = grand.genelMaliyet;
    const totalSalesAmount = grand.genelToplam;
    const grossProfit = totalSalesAmount - totalSupplierCost;
    const grossMarginPct = totalSalesAmount > 0 ? (grossProfit / totalSalesAmount) * 100 : 0;

    const buildingDamageTotal = items.reduce((s, i) =>
      (i.damageCategory ?? 'bina') === 'bina' ? s + repairItemSalesTotal(i) : s, 0)
      + maliMesuliyetAlanToplami(unlinkedNeighbor).sales;
    const goodsDamageTotal = items.reduce((s, i) =>
      (i.damageCategory ?? 'bina') === 'esya' ? s + repairItemSalesTotal(i) : s, 0);

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
    // Hasar Tespit: rapor toplamı tespit edilen hasardır; bütçe / beklenen gelir değildir.
    const kind = await this.prisma.claimFile.findUnique({
      where: { id: claimFileId },
      select: { serviceKind: true },
    });
    if (isInspectionServiceKind(kind?.serviceKind)) return;
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

  /** Saha tespit resimleri rapor Fotoğraflar altına düşer. PDF bu kopyayı beklemez. */
  private async attachClaimInspectionPhotosToReport(reportId: string, claimFileId: string) {
    if (!this.storage) return;
    const MAX_TESPT_PHOTOS = 48;
    try {
      const docs = await this.prisma.entityDocument.findMany({
        where: { entityType: 'claim_file', entityId: claimFileId },
        orderBy: { createdAt: 'asc' },
      });
      const photos = docs
        .filter((doc) => {
          const mime = String(doc.mimeType ?? '');
          const looksImage = mime.startsWith('image/') || /\.(jpe?g|png|webp|gif)$/i.test(doc.fileName);
          return looksImage && isHasarTespitPhotoNotes(doc.notes);
        })
        .slice(0, MAX_TESPT_PHOTOS);
      if (!photos.length) return;
      const existing = await this.prisma.reportImage.findMany({
        where: { reportId },
        select: { fileName: true, fileSize: true, caption: true },
      });
      const seen = new Set(existing.map((img) => `${img.fileName}|${img.fileSize}|${img.caption ?? ''}`));
      let sortOrder = existing.length;
      const dir = getReportImagesDir();
      fs.mkdirSync(dir, { recursive: true });
      for (const doc of photos) {
        const caption = ACIL_INSPECTION_PHOTO_NOTE;
        const key = `${doc.fileName}|${doc.fileSize}|${caption}`;
        if (seen.has(key)) continue;
        try {
          const buf = await this.storage.download(doc.storageKey);
          if (!buf.length) continue;
          const ext = path.extname(doc.fileName) || '.jpg';
          const storageKey = `tespit-${doc.id}${ext.toLowerCase()}`;
          fs.writeFileSync(path.join(dir, storageKey), buf);
          await this.prisma.reportImage.create({
            data: {
              reportId,
              storageKey,
              fileName: doc.fileName,
              mimeType: doc.mimeType || 'image/jpeg',
              fileSize: buf.length,
              category: 'damage',
              caption,
              sortOrder,
            },
          });
          sortOrder += 1;
          seen.add(key);
        } catch (err) {
          this.logger.warn(
            `Tespit resmi rapora alınamadı (${doc.id}): ${err instanceof Error ? err.message : err}`,
          );
        }
      }
    } catch (err) {
      this.logger.warn(
        `Tespit resmi rapora bağlanamadı (${reportId}): ${err instanceof Error ? err.message : err}`,
      );
    }
  }

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
    await this.prisma.reportImage.delete({ where: { id: imageId } });
    // Revizyon eski raporun resmini aynı anahtarla taşır; başka kayıt kullanıyorsa dosya diskte kalır.
    for (const key of [img.storageKey, img.annotatedKey]) {
      if (!key) continue;
      const stillUsed = await this.prisma.reportImage.count({
        where: { OR: [{ storageKey: key }, { annotatedKey: key }] },
      });
      if (stillUsed > 0) continue;
      try {
        const filePath = resolveReportImageFilePath(key);
        if (filePath) fs.unlinkSync(filePath);
      } catch {
        /* dosya yoksa DB kaydı yine silinir */
      }
    }
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
      const supplierTotal = dtItems.reduce((s, i) => s + repairItemResolvedSupplierTotal(i), 0);
      const salesTotal = dtItems.reduce((s, i) => s + repairItemSalesTotal(i), 0);
      const marginPct = salesTotal > 0 ? ((salesTotal - supplierTotal) / salesTotal) * 100 : 0;
      return { id: dt.id, name: dt.damageTypeName, supplierTotal, salesTotal, marginPct };
    });

    const unassignedItems = report.items.filter((i: { damageTypeId: string | null }) => !i.damageTypeId);
    const unassigned = {
      supplierTotal: unassignedItems.reduce((s, i) => s + repairItemResolvedSupplierTotal(i), 0),
      salesTotal: unassignedItems.reduce((s, i) => s + repairItemSalesTotal(i), 0),
    };

    return { damageTypes, unassigned };
  }

  // ── PDF & Email ────────────────────────────────────────────────────────────

  /** PDF — tespit resmi kopyası beklemez; eksper kolonu yoksa rapor yine açılır. */
  private async getReportForPdf(reportId: string) {
    await this.healInflatedSupplierTotals(reportId);
    const report = await this.findReportWithInclude(reportId);
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
    const withInspector =
      !report.inspectorName?.trim() && vendorName
        ? { ...report, inspectorName: vendorName }
        : report;
    const priced = await this.attachExtraRepairCostLayout(this.overlayReportItemMoney(withInspector));
    const { card } = await serviceMailRouteForClaim(this.prisma, {
      serviceKind: priced.claimFile?.serviceKind,
      consultancyServiceType: priced.claimFile?.consultancyServiceType,
    });
    return { ...priced, showPrices: card ? card.reportPrice !== false : true };
  }

  /** Onaya gönderim hitabı için e-posta → görünen ad (kişi tercih, yoksa kurum). */
  private approvalRecipientDisplayNames(claimFile: {
    insuranceCompany?: { name?: string | null; contactEmail?: string | null } | null;
    channelAgencyCustomer?: {
      email?: string | null;
      name?: string | null;
      companyName?: string | null;
      shortName?: string | null;
      contacts?: Array<{ name?: string | null; email?: string | null }> | null;
    } | null;
    channelBrokerCustomer?: {
      email?: string | null;
      name?: string | null;
      companyName?: string | null;
      shortName?: string | null;
      contacts?: Array<{ name?: string | null; email?: string | null }> | null;
    } | null;
    channelExpertCustomer?: {
      email?: string | null;
      name?: string | null;
      companyName?: string | null;
      shortName?: string | null;
      contacts?: Array<{ name?: string | null; email?: string | null }> | null;
    } | null;
    customer?: {
      email?: string | null;
      name?: string | null;
      companyName?: string | null;
      shortName?: string | null;
      contacts?: Array<{ name?: string | null; email?: string | null }> | null;
    } | null;
  } | null | undefined): Map<string, string> {
    const out = new Map<string, string>();
    const push = (email?: string | null, name?: string | null) => {
      const key = String(email ?? '').trim().toLowerCase();
      const label = String(name ?? '').trim();
      if (!key.includes('@') || !label || out.has(key)) return;
      out.set(key, label);
    };
    const orgName = (row?: {
      shortName?: string | null;
      companyName?: string | null;
      name?: string | null;
    } | null) =>
      String(row?.shortName ?? row?.companyName ?? row?.name ?? '').trim();
    const walk = (row?: {
      email?: string | null;
      shortName?: string | null;
      companyName?: string | null;
      name?: string | null;
      contacts?: Array<{ name?: string | null; email?: string | null }> | null;
    } | null) => {
      if (!row) return;
      const org = orgName(row);
      for (const contact of row.contacts ?? []) {
        push(contact?.email, String(contact?.name ?? '').trim() || org);
      }
      push(row.email, org);
    };
    push(claimFile?.insuranceCompany?.contactEmail, claimFile?.insuranceCompany?.name);
    walk(claimFile?.channelAgencyCustomer);
    walk(claimFile?.channelBrokerCustomer);
    walk(
      claimApprovalExpertParty({
        channelExpert: claimFile?.channelExpertCustomer,
        customer: claimFile?.customer,
      }) as {
        email?: string | null;
        shortName?: string | null;
        companyName?: string | null;
        name?: string | null;
        contacts?: Array<{ name?: string | null; email?: string | null }> | null;
      } | null,
    );
    walk(claimFile?.customer);
    return out;
  }

  /** Dış rapor maili 3 MB altına inene kadar fotoğraf küçülür. Sayı tek başına yetmez. */
  private async externalMailPdf(reportId: string): Promise<Buffer> {
    const fits: Array<PdfImageFit | undefined> = [
      undefined,
      { maxEdge: 1000, quality: 58, maxBytes: 80_000 },
      { maxEdge: 720, quality: 46, maxBytes: 45_000 },
    ];
    let last = Buffer.alloc(0);
    for (const fit of fits) {
      const { buffer } = await this.generatePdf(reportId, 'external', fit);
      last = Buffer.from(buffer);
      if (buffer.length > 0 && buffer.length <= REPAIR_REPORT_MAIL_INLINE_MAX_BYTES) return buffer;
    }
    return last;
  }

  async generatePdf(
    reportId: string,
    viewType: 'internal' | 'external',
    imageFit?: PdfImageFit,
  ): Promise<{ buffer: Buffer; report: any }> {
    // PDF kök nedeni: getReport() claimFile include ile şema gerisi kolonları isterdi.
    // PDF yalnız gerekli alanları select eder.
    const report = await this.getReportForPdf(reportId);
    try {
      const buffer = await this.pdfService.generate(report as any, viewType, imageFit);
      return { buffer, report };
    } catch (error) {
      this.logger.error(`PDF generation failed for report ${reportId}: ${(error as Error)?.message ?? error}`);
      throw error;
    }
  }

  async sendEmail(reportId: string, dto: SendEmailDto) {
    const report = await this.getReport(reportId);
    // PDF önce — ek yoksa sendReport FAIL eder
    const pdfBuffer = await this.externalMailPdf(reportId);
    if (!pdfBuffer?.length) {
      throw new BadRequestException('PDF oluşmadı — e-posta gönderilemez');
    }
    const subject = dto.subject ?? `${hasarReportDocumentTitle(report.claimFile?.serviceKind, report.claimFile?.consultancyServiceType)} — ${report.reportNo}`;
    const appUrl = resolveAppUrl(this.config);
    const claimFileId = report.claimFileId ?? report.claimFile?.id;
    return this.emailService.sendReport({
      to: dto.to,
      subject,
      pdfBuffer,
      reportNo: report.reportNo,
      fileNo: report.claimFile?.fileNo,
      insuranceCompanyName: report.claimFile?.insuranceCompany?.name,
      fileSubject: report.claimFile?.claimSubject?.name,
      documentTitle: hasarReportDocumentTitle(
        report.claimFile?.serviceKind,
        report.claimFile?.consultancyServiceType,
      ),
      actionUrl: claimFileId ? buildPanelUrl(appUrl, panelHasarDosyasiPath(claimFileId)) : undefined,
      portalUrl: appUrl,
      viewType: 'external',
      ...reportMailSignature(report.claimFile),
    });
  }

  async getShareLink(reportId: string, userId: string) {
    const report = await this.prisma.repairReport.findUnique({
      where: { id: reportId },
      include: {
        claimFile: {
          select: {
            serviceKind: true,
            consultancyServiceType: { select: { code: true, name: true } },
          },
        },
      },
    });
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
    const docTitle = hasarReportDocumentTitle(
      report.claimFile?.serviceKind,
      report.claimFile?.consultancyServiceType,
    );
    return {
      url,
      whatsappUrl: `https://api.whatsapp.com/send?text=${encodeURIComponent(`${docTitle}: ${url}`)}`,
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

  private async getApprovers(): Promise<
    Array<{ id: string; expoPushToken: string | null; email: string; firstName: string; lastName: string; phone: string | null }>
  > {
    return this.prisma.user.findMany({
      where: {
        status: 'active',
        role: { code: { in: ['admin', 'ops_manager', 'manager', 'ADMIN', 'OPS_MANAGER', 'MANAGER'] } },
      },
      select: { id: true, expoPushToken: true, email: true, firstName: true, lastName: true, phone: true },
    });
  }

  async requestApproval(reportId: string, userId: string, dto?: RequestApprovalDto) {
    const report = await this.prisma.repairReport.findUnique({
      where: { id: reportId },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        items: {
          include: { workGroup: { select: { name: true } } },
        },
        images: { take: 8, orderBy: { sortOrder: 'asc' }, select: { storageKey: true, fileName: true, mimeType: true } },
        expertOffice: { select: { email: true, companyName: true } },
        claimFile: {
          select: {
            id: true,
            fileNo: true,
            serviceKind: true,
            mailRouteJson: true,
            siteContactEmail: true,
            consultancyServiceType: { select: { code: true, name: true } },
            insuranceCompany: { select: { id: true, name: true, contactEmail: true } },
            claimSubject: { select: { name: true } },
            propertyAddress: { select: { city: true, district: true } },
            assignedOfficeUser: { select: { firstName: true, lastName: true, phone: true, email: true } },
            customer: {
              select: {
                email: true,
                shortName: true,
                companyName: true,
                fullName: true,
                entityType: true,
                subType: true,
                contacts: { select: { email: true, isPrimary: true } },
                contactInfos: { select: { type: true, label: true, value: true } },
              },
            },
            channelAgencyCustomer: {
              select: {
                email: true,
                companyName: true,
                shortName: true,
                contacts: { select: { id: true, name: true, email: true, isPrimary: true } },
                contactInfos: { select: { type: true, label: true, value: true } },
              },
            },
            channelBrokerCustomer: {
              select: {
                email: true,
                companyName: true,
                shortName: true,
                contacts: { select: { id: true, name: true, email: true, isPrimary: true } },
                contactInfos: { select: { type: true, label: true, value: true } },
              },
            },
            channelExpertCustomer: {
              select: {
                email: true,
                companyName: true,
                shortName: true,
                contacts: { select: { id: true, name: true, email: true, isPrimary: true } },
                contactInfos: { select: { type: true, label: true, value: true } },
              },
            },
          },
        },
      },
    });
    if (!report) throw new NotFoundException('Rapor bulunamadı');
    if (report.status !== 'draft' && report.status !== 'rejected') {
      throw new BadRequestException('Yalnızca taslak veya reddedilmiş raporlar onaya gönderilebilir');
    }

    if (!report.findingsText?.trim()) {
      throw new BadRequestException('Tespit Bulguları doldurulmadan onaya gönderilemez.');
    }
    const hizmetMail = await serviceMailRouteForClaim(this.prisma, {
      serviceKind: report.claimFile?.serviceKind,
      consultancyServiceType: report.claimFile?.consultancyServiceType,
    });
    const requirePricedItems = hizmetMail.card?.reportPrice === false
      ? false
      : repairReportRequiresPricedItems(
        report.claimFile?.serviceKind,
        report.claimFile?.consultancyServiceType,
      );
    if (requirePricedItems && report.items.length === 0) {
      throw new BadRequestException('En az bir onarım kalemi eklenmeden onaya gönderilemez.');
    }
    const totalSales = report.items.reduce((sum, item) => sum + repairItemSalesTotal(item), 0);
    const totalCost = report.items.reduce((sum, item) => sum + repairItemResolvedSupplierTotal(item), 0);
    const totalLumpSum = report.items.reduce((sum, item) => {
      if (item.pricingType === 'lumpsum') return sum + repairItemSalesTotal(item);
      return sum;
    }, 0);
    const headerSales = Number(report.totalSalesAmount ?? 0);
    const headerCost = Number(report.totalSupplierCost ?? 0);
    if (
      requirePricedItems
      && totalSales <= 0
      && totalCost <= 0
      && totalLumpSum <= 0
      && !(headerSales > 0)
      && !(headerCost > 0)
    ) {
      throw new BadRequestException('Maliyet veya satış tutarı girilmeden onaya gönderilemez.');
    }

    const mailRoute = resolveClaimMailRoute({
      serviceKind: report.claimFile?.serviceKind,
      consultancyServiceType: report.claimFile?.consultancyServiceType,
      mailRouteJson: report.claimFile?.mailRouteJson,
      serviceMailRoute: hizmetMail.route,
    });
    const approvalParties = new Set(mailRoute?.approval ?? []);
    const channelMail = collectClaimFileChannelEmails({
      insuranceContactEmail: !mailRoute || approvalParties.has('insurance')
        ? report.claimFile?.insuranceCompany?.contactEmail
        : null,
      agency: !mailRoute || approvalParties.has('agency') ? report.claimFile?.channelAgencyCustomer : null,
      broker: !mailRoute || approvalParties.has('broker') ? report.claimFile?.channelBrokerCustomer : null,
      expert: !mailRoute || approvalParties.has('expert')
        ? claimApprovalExpertParty({
          channelExpert: report.claimFile?.channelExpertCustomer,
          customer: report.claimFile?.customer,
        })
        : null,
    });
    const cardRecipients = () => resolveReportCustomerMailRecipients({
      customerEmail: report.claimFile?.customer?.email,
      contacts: report.claimFile?.customer?.contacts,
      channelEmails: generalMailboxesFromContactInfos(report.claimFile?.customer?.contactInfos),
      fileChannelEmails: channelMail,
      expertOfficeEmail: report.expertOffice?.email,
    });
    const allowedRecipients = mailRoute ? [...channelMail] : cardRecipients();
    if (allowedRecipients.length === 0) {
      allowedRecipients.push(...cardRecipients());
    }
    const irtibatEmail = String(report.claimFile?.siteContactEmail ?? '').trim().toLowerCase();
    if (
      !repairReportRequiresPricedItems(
        report.claimFile?.serviceKind,
        report.claimFile?.consultancyServiceType,
      )
      && irtibatEmail.includes('@')
      && !allowedRecipients.includes(irtibatEmail)
    ) {
      allowedRecipients.push(irtibatEmail);
    }
    const customerPdf = await this.externalMailPdf(reportId);
    if (!customerPdf?.length) {
      throw new BadRequestException('Müşteri raporu PDF oluşmadı — e-posta gönderilemez.');
    }
    if (allowedRecipients.length === 0) {
      throw new BadRequestException(
        mailRoute
          ? 'Seçilen mail tarafında e-posta yok. Adresi yazmadan rapor onaya gönderilemez.'
          : 'Dosya kanalında veya müşteri kartında e-posta yok. Adresi yazmadan rapor onaya gönderilemez.',
      );
    }
    const customerRecipients = filterSelectedApprovalEmails(
      allowedRecipients,
      dto?.selectedEmails,
      { allowManualExtra: true },
    );
    if (customerRecipients.length === 0) {
      throw new BadRequestException('En az bir Kime alıcısı seçilmelidir.');
    }
    const selectedCc = (
      dto?.selectedCcEmails?.length
        ? filterSelectedApprovalEmails(allowedRecipients, dto.selectedCcEmails, {
            allowManualExtra: true,
          })
        : []
    ).filter((email) => !customerRecipients.some((to) => to.toLowerCase() === email.toLowerCase()));
    const selectedBcc = (
      dto?.selectedBccEmails?.length
        ? filterSelectedApprovalEmails(allowedRecipients, dto.selectedBccEmails, {
            allowManualExtra: true,
          })
        : []
    ).filter(
      (email) =>
        !customerRecipients.some((to) => to.toLowerCase() === email.toLowerCase())
        && !selectedCc.some((cc) => cc.toLowerCase() === email.toLowerCase()),
    );
    const appUrl = resolveAppUrl(this.config);
    const claimFileId = report.claimFileId ?? report.claimFile?.id;
    const claimCustomer = claimFileId
      ? await this.prisma.claimFile.findUnique({ where: { id: claimFileId }, select: { customerId: true } })
      : null;
    const copyRows = claimCustomer?.customerId
      ? await this.prisma.customerContact.findMany({
        where: { customerId: claimCustomer.customerId },
        select: { email: true, mailCopyApproval: true },
      })
      : [];
    const approvalCopies = customerContactCopyEmails(copyRows, 'approval')
      .filter((email) => !customerRecipients.some((to) => to.toLowerCase() === email) && !isMeridyenInternalMailbox(email));
    const sender = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        firstName: true,
        lastName: true,
        role: { select: { code: true } },
      },
    });
    const informCc = resolveApprovalInformCc(sender);
    const fileOwnerCc = resolveApprovalFileOwnerCc(report.claimFile?.assignedOfficeUser);
    const mailCc = mergeApprovalMailCc({
      informCc,
      extraCc: [
        ...(fileOwnerCc ? [fileOwnerCc] : []),
        ...selectedCc.map((email) => ({ email })),
        ...approvalCopies.map((email) => ({ email })),
      ],
      toEmails: customerRecipients,
    });
    const mailBcc = selectedBcc
      .filter(
        (email) =>
          !mailCc.some((row) => row.email.toLowerCase() === email.toLowerCase())
          && (!informCc || informCc.email.toLowerCase() !== email.toLowerCase()),
      )
      .map((email) => ({ email }));
    const informNotice = informCc
      ? buildPlatformMailCopyNotice({
        counterpartName: report.claimFile?.insuranceCompany?.name,
        counterpartAddress: customerRecipients[0],
        sender: informCc,
        roleCode: sender?.role?.code,
      })
      : null;
    const recipientNameByEmail = this.approvalRecipientDisplayNames(report.claimFile);
    const documentTitle = hasarReportDocumentTitle(
      report.claimFile?.serviceKind,
      report.claimFile?.consultancyServiceType,
    );
    const customerName = claimApprovalCustomerDisplayName(report.claimFile?.customer);
    const mailSubject = buildClaimApprovalMailSubject(
      documentTitle,
      customerName,
      report.claimFile?.fileNo ?? report.reportNo,
    );
    const hasCustomMessage = String(dto?.messageText ?? '').trim().length > 0;
    const messageParts = hasCustomMessage
      ? splitClaimApprovalMessageText(dto?.messageText)
      : { greeting: '', body: '' };
    for (let index = 0; index < customerRecipients.length; index += 1) {
      const recipient = customerRecipients[index];
      const recipientName = recipientNameByEmail.get(recipient.trim().toLowerCase()) ?? '';
      const mailed = await this.emailService.sendReport({
        to: recipient,
        cc: index === 0 ? mailCc : undefined,
        bcc: index === 0 && mailBcc.length ? mailBcc : undefined,
        copyNoticeHtml: index === 0 ? informNotice?.html : undefined,
        copyNoticeText: index === 0 ? informNotice?.plain : undefined,
        requestReadReceipt: true,
        subject: mailSubject,
        pdfBuffer: customerPdf,
        reportNo: report.reportNo,
        fileNo: report.claimFile?.fileNo,
        insuranceCompanyName: report.claimFile?.insuranceCompany?.name,
        fileSubject: report.claimFile?.claimSubject?.name,
        documentTitle,
        messageGreeting: hasCustomMessage ? messageParts.greeting : undefined,
        messageBody: hasCustomMessage ? messageParts.body : undefined,
        recipientSurname: approvalRecipientSurname(recipientName),
        actionUrl: claimFileId ? buildPanelUrl(appUrl, panelHasarDosyasiPath(claimFileId)) : undefined,
        portalUrl: appUrl,
        viewType: 'external',
        ...reportMailSignature(report.claimFile),
      });
      if (!mailed.success) {
        throw new BadRequestException(
          mailed.message || `Rapor e-postası gönderilemedi: ${recipient}`,
        );
      }
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
    await this.ensureHasarTespitInvoiceRequest(report.claimFileId, userId);

    const lineSummary = report.items
      .slice(0, 12)
      .map((item) => {
        const name = item.workGroup?.name || item.jobDescription || 'Kalem';
        const amt = repairItemSalesTotal(item);
        return `${name}: ${Math.round(amt).toLocaleString('tr-TR')} ₺`;
      })
      .join(' · ');
    const photoAttachments: Array<{ filename: string; content: Buffer; contentType?: string }> = [];
    for (const img of report.images ?? []) {
      const filePath = resolveReportImageFilePath(img.storageKey);
      if (!filePath) continue;
      try {
        const buf = fs.readFileSync(filePath);
        if (buf.length > 4_000_000) continue;
        photoAttachments.push({
          filename: img.fileName || 'resim.jpg',
          content: buf,
          contentType: img.mimeType || 'image/jpeg',
        });
      } catch {
        /* yok */
      }
    }
    let internalPdf: Buffer | null = null;
    try {
      const generated = await this.generatePdf(reportId, 'internal');
      if (generated.buffer?.length) internalPdf = generated.buffer;
    } catch (error) {
      this.logger.error(
        `Yönetici iç PDF oluşmadı: ${report.reportNo} | ${(error as Error)?.message ?? error}`,
      );
    }
    const managerAttachments = packInlineMailAttachments([
      ...(internalPdf
        ? [
            {
              filename: internalRepairPdfFilename(report.reportNo),
              content: internalPdf,
              contentType: 'application/pdf',
            },
          ]
        : []),
      ...photoAttachments,
    ]);
    const money = (n: number) => `${Math.round(n).toLocaleString('tr-TR')} ₺`;
    const waLines = [
      `Onay bekleyen rapor ${report.reportNo}`,
      `Dosya ${report.claimFile?.fileNo ?? ''}`,
      `Satış ${money(totalSales)} · Maliyet ${money(totalCost)} · Kâr ${money(totalSales - totalCost)}`,
      lineSummary,
      'Resimler mailde ve panelde.',
    ]
      .filter(Boolean)
      .join('\n');

    const approvers = await this.getApprovers();
    for (const approver of approvers) {
      if (approver.id === userId) continue;
      await this.createNotification(
        approver.id,
        'report_approval_requested',
        'Onay Bekleyen Rapor',
        `${report.reportNo} numaralı rapor onayınızı bekliyor.`,
        reportId,
      );
      if (this.claimEventEmail && approver.email) {
        const managerMail = await this.claimEventEmail.onManagerApprovalRequested({
          recipientEmail: approver.email,
          recipientName: `${approver.firstName} ${approver.lastName}`.trim(),
          fileNo: report.claimFile?.fileNo ?? '',
          reportNo: report.reportNo,
          claimFileId: report.claimFileId,
          reportId,
          lineSummary,
          salesLabel: money(totalSales),
          costLabel: money(totalCost),
          profitLabel: money(totalSales - totalCost),
          attachments: managerAttachments,
        });
        if (!managerMail.sent) {
          this.logger.error(
            `Yönetici e-postası gönderilemedi: ${approver.email} | ${managerMail.errorMsg ?? ''}`,
          );
        }
      }
      const waUrl = buildWhatsAppMeUrl(approver.phone, waLines);
      if (waUrl) {
        await this.prisma.fileActivityLog.create({
          data: {
            claimFileId: report.claimFileId,
            actorId: userId,
            actorRole: 'office_staff',
            action: 'WHATSAPP_STATUS_RECORDED',
            description: `Yönetici onay WhatsApp hazırlandı · ${approver.firstName} ${approver.lastName}`.trim(),
            metadata: {
              kind: 'manager_approval_whatsapp',
              purpose: 'yonetici_onay',
              phone: approver.phone,
              url: waUrl,
              status: 'ready',
            },
          },
        });
      }
    }

    return this.getReport(reportId);
  }

  async approveReport(reportId: string, userId: string, reason?: string) {
    const report = await this.prisma.repairReport.findUnique({
      where: { id: reportId },
      include: {
        createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        expertOffice: { select: { shortName: true, companyName: true, fullName: true } },
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
    await markExtraRepairApprovedForReport(this.prisma, reportId);

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
        insuranceCompanyName: report.claimFile?.insuranceCompany?.name ?? '',
        expertOfficeName:
          report.expertOffice?.shortName
          || report.expertOffice?.companyName
          || report.expertOffice?.fullName
          || '',
        approvedBy: approver ? `${approver.firstName} ${approver.lastName}` : '',
        claimFileId: report.claimFileId,
        reportId,
        recipientFirstName: (report.createdBy as any)?.firstName,
        recipientLastName: (report.createdBy as any)?.lastName,
        inspection: isInspectionServiceKind((report.claimFile as { serviceKind?: string | null } | null)?.serviceKind),
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
    const trimmedReason = String(reason ?? '').trim();
    if (!trimmedReason) {
      throw new BadRequestException('Red nedeni yazılmalıdır.');
    }

    await this.prisma.repairReport.update({
      where: { id: reportId },
      data: { status: 'rejected' },
    });

    await this.prisma.reportApprovalHistory.create({
      data: { reportId, userId, action: 'rejected', reason: trimmedReason },
    });

    // Notify report creator (in-app)
    await this.createNotification(
      report.createdByUserId,
      'report_rejected',
      'Raporunuz Reddedildi',
      `${report.reportNo} numaralı raporunuz reddedildi. Neden: ${trimmedReason}`,
      reportId,
    );

    // Email bildirimi
    if (this.claimEventEmail && (report.createdBy as any)?.email) {
      void this.claimEventEmail.onReportRejected({
        recipientEmail: (report.createdBy as any).email,
        recipientUserId: report.createdByUserId,
        reportNo: report.reportNo,
        fileNo: (report.claimFile as any)?.fileNo ?? '',
        rejectionReason: trimmedReason,
        claimFileId: report.claimFileId,
        reportId,
      });
    }

    await this.syncClaimFromLatestReport(report.claimFileId);

    await this.supersedeOpenWritingReports(
      report.claimFileId,
      userId,
      trimmedReason,
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
        id: { not: reportId },
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
