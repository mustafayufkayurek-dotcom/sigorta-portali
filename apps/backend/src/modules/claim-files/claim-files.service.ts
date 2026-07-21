import { Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException, Optional, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import {
  applyClaimFileListScope,
  assertClaimFileAccess,
  normalizeRequestUser,
} from '@/common/helpers/claim-file-scope.helper';
import { canViewFileFinancials, normalizeFinancialVisibilityConfig, resolveFinancialVisibilityConfig, canManageFinancialVisibility } from '@/common/helpers/financial-visibility.helper';
import { ClaimEventEmailService } from '@/modules/notifications/email/claim-event-email.service';
import { SmsService } from '@/modules/notifications/sms/sms.service';
import { MessageTemplateService, TEMPLATE_TYPES } from '@/modules/notifications/sms/message-template.service';
import { AuditLogsService } from '@/modules/audit-logs/audit-logs.service';
import { CacheService } from '@/cache/cache.service';
import { ClaimResponsibilitiesService } from '@/modules/claim-responsibilities/claim-responsibilities.service';
import { OperationalAccessGrantsService } from '@/modules/operational-access-grants/operational-access-grants.service';
import { VendorIntelligenceProfileService } from '@/modules/vendor-intelligence-profile/vendor-intelligence-profile.service';
import {
  findClaimFileIdByCompactFileNo,
  findEmergencyCaseIdByCompactFileNo,
} from '@/common/utils/file-no-helpers';
import {
  buildVendorNearbyWhere,
  buildInspectorFallbackWhere,
  buildSupplierFallbackWhere,
  normalizeLocationLabel,
  resolveProvinceDistrictIds,
} from './vendor-area-match.util';
import { resolveCityDistrictFromAddress } from '@/modules/operation-inbox/inbound-location.util';
import {
  resolveClaimSubjectIdByLabel,
  sanitizeInboundLossType,
} from '@/common/helpers/ihbar-konusu.helper';
import { resolveDepartmentFileSubjectByLabel } from '@/common/helpers/dosya-konusu.helper';
import {
  APPROVAL_WAITING_REPORT_STATUSES,
  CLOSED_CLAIM_STATUS_CODES,
  FINANCE_TRANSFER_STATUS_CODES,
  deriveOperationStage,
  hoursSince,
  isApproval72hExceeded,
  isApprovalWaitingReport,
  type OperationPreset,
} from '@sigorta/shared';

const APPROVED_REPAIR_REPORT_STATUSES = ['approved', 'externally_approved'] as const;
const APPROVAL_72H_MS = 72 * 60 * 60 * 1000;

const LATEST_REPAIR_REPORT_SELECT = {
  id: true,
  claimFileId: true,
  reportNo: true,
  status: true,
  totalSalesAmount: true,
  totalSupplierCost: true,
  grossProfit: true,
  grossMarginPct: true,
  updatedAt: true,
  inspectorName: true,
  expertOffice: { select: { id: true, companyName: true } },
} as const;

function formatLatestRepairReport(report: {
  id: string;
  reportNo: string;
  status: string;
  totalSalesAmount: number;
  totalSupplierCost: number;
  grossProfit: number;
  grossMarginPct: number;
  updatedAt: Date;
  inspectorName?: string | null;
  expertOffice?: { id: string; companyName: string | null } | null;
}) {
  return {
    id: report.id,
    reportNo: report.reportNo,
    status: report.status,
    totalSalesAmount: report.totalSalesAmount,
    totalSupplierCost: report.totalSupplierCost,
    grossProfit: report.grossProfit,
    grossMarginPct: report.grossMarginPct,
    updatedAt: report.updatedAt,
    inspectorName: report.inspectorName ?? null,
    expertOffice: report.expertOffice ?? null,
  };
}

type LatestRepairReportRow = {
  id: string;
  claimFileId: string;
  reportNo: string;
  status: string;
  totalSalesAmount: number;
  totalSupplierCost: number;
  grossProfit: number;
  grossMarginPct: number;
  updatedAt: Date;
};

function pickPreferredRepairReport(reports: LatestRepairReportRow[]): LatestRepairReportRow | null {
  if (!reports.length) return null;
  const approved = reports.find((r) =>
    (APPROVED_REPAIR_REPORT_STATUSES as readonly string[]).includes(r.status),
  );
  return approved ?? reports[0];
}

function pickPreferredRepairReportsByClaim(
  reports: LatestRepairReportRow[],
): Map<string, LatestRepairReportRow> {
  const byClaim = new Map<string, LatestRepairReportRow[]>();
  for (const report of reports) {
    const list = byClaim.get(report.claimFileId) ?? [];
    list.push(report);
    byClaim.set(report.claimFileId, list);
  }
  const result = new Map<string, LatestRepairReportRow>();
  for (const [claimId, claimReports] of byClaim) {
    const picked = pickPreferredRepairReport(claimReports);
    if (picked) result.set(claimId, picked);
  }
  return result;
}

// Valid forward transitions for each status code
const STATUS_TRANSITIONS: Record<string, string[]> = {
  new: ['in_progress', 'cancelled'],
  in_progress: ['pending_info', 'inspection', 'completed', 'cancelled'],
  pending_info: ['in_progress', 'cancelled'],
  inspection: ['in_progress', 'completed', 'cancelled'],
  completed: ['closed'],
  cancelled: [],
  closed: [],
};

const STATUS_CODE_LABELS: Record<string, string> = {
  SUPPLIER_ASSIGNED: 'Tedarikçi Atandı',
  APPOINTMENT_SCHEDULED: 'Randevu Planlandı',
  INSPECTION_DONE: 'Tespit Yapıldı',
  COST_REPORT_SUBMITTED: 'Maliyet Raporu Gönderildi',
};

const STATUS_CODE_COLORS: Record<string, string> = {
  SUPPLIER_ASSIGNED: '#8B5CF6',
  APPOINTMENT_SCHEDULED: '#3B82F6',
  INSPECTION_DONE: '#F59E0B',
  COST_REPORT_SUBMITTED: '#10B981',
};

@Injectable()
export class ClaimFilesService {
  private readonly logger = new Logger(ClaimFilesService.name);

  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
    private readonly auditLogsService: AuditLogsService,
    @Optional() private readonly claimEventEmail?: ClaimEventEmailService,
    @Optional() private readonly smsService?: SmsService,
    @Optional() private readonly templateService?: MessageTemplateService,
    @Optional() private readonly claimResponsibilities?: ClaimResponsibilitiesService,
    @Optional() private readonly operationalAccessGrants?: OperationalAccessGrantsService,
    @Optional() private readonly vendorProfile?: VendorIntelligenceProfileService,
  ) {}

  private async resolveHasarDepartmentId(): Promise<string | null> {
    const dept = await this.prisma.department.findFirst({
      where: { code: 'hasar-onarim', status: 'active' },
      select: { id: true },
    });
    return dept?.id ?? null;
  }

  private async fallbackHasarOfficeUserId(): Promise<string | null> {
    const user = await this.prisma.user.findFirst({
      where: {
        email: { equals: 'hasar@safranbh.com', mode: 'insensitive' },
        status: 'active',
      },
      select: { id: true },
    });
    return user?.id ?? null;
  }

  private async userMatchesInsuranceScope(userId: string, insuranceCompanyId: string): Promise<boolean> {
    const scopes = await this.getInsuranceScopes(userId);
    if (scopes.length === 0) return true;
    return scopes.includes(insuranceCompanyId);
  }

  /** Eksper portal ihbarında ofis sorumlusu: önce sorumluluk kuralı, yoksa hasar@ yedeği. */
  private async resolveExpertPortalOfficeUserId(params: {
    insuranceCompanyId: string;
    city?: string;
    district?: string;
    departmentId?: string | null;
    claimSubjectId?: string | null;
  }): Promise<{ officeUserId: string | null; departmentId: string | null }> {
    let departmentId = params.departmentId ?? null;
    if (!departmentId) {
      departmentId = await this.resolveHasarDepartmentId();
    }

    const city = params.city?.trim() || 'Belirtilmemiş';
    const district = params.district?.trim() || undefined;

    if (departmentId && this.claimResponsibilities) {
      const responsible = await this.claimResponsibilities.findResponsibleUser({
        departmentId,
        city,
        district,
        claimSubjectId: params.claimSubjectId ?? undefined,
      });
      if (responsible?.id && await this.userMatchesInsuranceScope(responsible.id, params.insuranceCompanyId)) {
        return { officeUserId: responsible.id, departmentId };
      }
    }

    const fallbackId = await this.fallbackHasarOfficeUserId();
    if (fallbackId && await this.userMatchesInsuranceScope(fallbackId, params.insuranceCompanyId)) {
      return { officeUserId: fallbackId, departmentId };
    }

    return { officeUserId: null, departmentId };
  }

  private async createInAppNotification(params: {
    userId: string;
    type: string;
    title: string;
    body: string;
    relatedEntityId?: string;
  }): Promise<void> {
    try {
      await this.prisma.notification.create({
        data: {
          userId: params.userId,
          type: params.type,
          title: params.title,
          body: params.body,
          channel: 'in_app',
          status: 'unread',
          relatedEntityType: params.relatedEntityId ? 'claim_file' : null,
          relatedEntityId: params.relatedEntityId ?? null,
        },
      });
    } catch (err: any) {
      this.logger.warn(`[ClaimFiles] In-app bildirim oluşturulamadı: ${err?.message}`);
    }
  }

  async findStatuses() {
    return this.prisma.claimStatus.findMany({
      orderBy: { sequenceNo: 'asc' },
    });
  }

  /**
   * Müşteri detay sayfası için zorunlu customerId kapsamlı liste.
   * Generic GET /claim-files yerine bu metot kullanılmalıdır.
   */
  async findAllForCustomer(
    customerId: string,
    params?: {
      page?: number;
      limit?: number;
      statusId?: string;
      insuranceCompanyId?: string;
      assignedFieldUserId?: string;
      assignedOfficeUserId?: string;
      assignedAdjusterId?: string;
      insuranceCompanyIds?: string[];
      invoiceStatus?: string;
      repairReportStatus?: string;
    },
    requestingUser?: { id: string; roleCode: string },
  ) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true },
    });
    if (!customer) {
      throw new NotFoundException('Müşteri bulunamadı');
    }

    return this.findAll({ ...params, customerId }, requestingUser);
  }

  private startOfUtcDay(dateStr?: string): Date {
    if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return new Date(`${dateStr}T00:00:00.000Z`);
    }
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }

  private endOfUtcDay(dateStr?: string): Date {
    const start = this.startOfUtcDay(dateStr);
    return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
  }

  private parseSort(sort?: string): Record<string, 'asc' | 'desc'> {
    const raw = String(sort ?? 'createdAt:desc').trim();
    const [fieldRaw, dirRaw] = raw.split(':');
    const dir = dirRaw === 'asc' ? 'asc' : 'desc';
    const field = fieldRaw === 'lossDate' ? 'incidentDate' : fieldRaw;
    const allowed = new Set(['createdAt', 'updatedAt', 'fileNo', 'notificationDate', 'incidentDate', 'priority']);
    if (!allowed.has(field)) return { createdAt: 'desc' };
    return { [field]: dir };
  }

  private applyOpsPresetWhere(
    baseWhere: Record<string, unknown>,
    preset: OperationPreset | string | undefined,
    requestingUser?: { id: string; roleCode: string },
  ): void {
    if (!preset) return;
    const now = new Date();
    const seventyTwoAgo = new Date(now.getTime() - APPROVAL_72H_MS);
    const awaitingReport = {
      some: { status: { in: [...APPROVAL_WAITING_REPORT_STATUSES] } },
    };

    switch (preset) {
      case 'approval_pending':
      case 'report_approval':
        baseWhere.repairReports = awaitingReport;
        break;
      case 'approval_72h':
        baseWhere.repairReports = {
          some: {
            status: { in: [...APPROVAL_WAITING_REPORT_STATUSES] },
            updatedAt: { lte: seventyTwoAgo },
          },
        };
        break;
      case 'report_writing':
        baseWhere.OR = [
          { currentStatus: { code: 'budget_preparing' } },
          { repairReports: { some: { status: { in: ['draft', 'rejected'] } } } },
        ];
        break;
      case 'finance_transfer':
        baseWhere.currentStatus = { code: { in: [...FINANCE_TRANSFER_STATUS_CODES] } };
        break;
      case 'delay_risk':
        baseWhere.OR = [
          { slaDueAt: { lt: now } },
          {
            repairReports: {
              some: {
                status: { in: [...APPROVAL_WAITING_REPORT_STATUSES] },
                updatedAt: { lte: seventyTwoAgo },
              },
            },
          },
        ];
        break;
      case 'opened_today': {
        const from = this.startOfUtcDay();
        const to = this.endOfUtcDay();
        baseWhere.createdAt = { gte: from, lte: to };
        break;
      }
      case 'assigned_to_me':
        if (requestingUser?.id) {
          baseWhere.OR = [
            { assignedOfficeUserId: requestingUser.id },
            { assignedFieldUserId: requestingUser.id },
            { currentResponsibleUserId: requestingUser.id },
          ];
        }
        break;
      case 'urgent':
        baseWhere.priority = { in: ['urgent', 'high', 'acil'] };
        break;
      case 'open':
        baseWhere.currentStatus = { code: { notIn: [...CLOSED_CLAIM_STATUS_CODES] } };
        break;
      default:
        break;
    }
  }

  async findAll(params?: {
    page?: number;
    limit?: number;
    customerId?: string;
    statusId?: string;
    statusCode?: string;
    insuranceCompanyId?: string;
    assignedFieldUserId?: string;
    assignedOfficeUserId?: string;
    assignedAdjusterId?: string;
    insuranceCompanyIds?: string[];
    invoiceStatus?: string;
    repairReportStatus?: string;
    dateFrom?: string;
    dateTo?: string;
    slaExceeded?: string | boolean;
    sort?: string;
    opsPreset?: string;
    search?: string;
  }, requestingUser?: { id: string; roleCode: string }) {
    const page = Number(params?.page) || 1;
    const limit = Math.min(Number(params?.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const baseWhere: Record<string, unknown> = {};
    if (params?.customerId) baseWhere.customerId = params.customerId;
    if (params?.statusId) baseWhere.currentStatusId = params.statusId;
    if (params?.insuranceCompanyId) baseWhere.insuranceCompanyId = params.insuranceCompanyId;
    if (params?.assignedFieldUserId) baseWhere.assignedFieldUserId = params.assignedFieldUserId;
    if (params?.assignedOfficeUserId) baseWhere.assignedOfficeUserId = params.assignedOfficeUserId;
    if (params?.assignedAdjusterId && requestingUser?.roleCode !== 'expert') {
      baseWhere.assignedAdjusterId = params.assignedAdjusterId;
    }
    if (params?.insuranceCompanyIds?.length) {
      baseWhere.insuranceCompanyId = { in: params.insuranceCompanyIds };
    }
    if (params?.invoiceStatus) {
      if (params.invoiceStatus === 'none') {
        baseWhere.invoices = { none: {} };
      } else {
        baseWhere.invoices = { some: { status: params.invoiceStatus } };
      }
    }
    if (params?.repairReportStatus) {
      baseWhere.repairReports = { some: { status: params.repairReportStatus } };
    }

    const statusCode = String(params?.statusCode ?? '').trim().toLowerCase();
    if (statusCode === 'open') {
      baseWhere.currentStatus = { code: { notIn: [...CLOSED_CLAIM_STATUS_CODES] } };
    } else if (statusCode) {
      baseWhere.currentStatus = { code: statusCode };
    }

    if (params?.dateFrom || params?.dateTo) {
      const createdAt: Record<string, Date> = {};
      if (params.dateFrom) createdAt.gte = this.startOfUtcDay(params.dateFrom);
      if (params.dateTo) createdAt.lte = this.endOfUtcDay(params.dateTo);
      baseWhere.createdAt = createdAt;
    }

    const slaFlag = params?.slaExceeded === true || params?.slaExceeded === 'true' || params?.slaExceeded === '1';
    if (slaFlag) {
      baseWhere.slaDueAt = { lt: new Date() };
    }

    if (params?.search?.trim()) {
      const q = params.search.trim();
      baseWhere.OR = [
        { fileNo: { contains: q, mode: 'insensitive' } },
        { claimNo: { contains: q, mode: 'insensitive' } },
        { insuredName: { contains: q, mode: 'insensitive' } },
        { customer: { companyName: { contains: q, mode: 'insensitive' } } },
        { customer: { fullName: { contains: q, mode: 'insensitive' } } },
        { customer: { firstName: { contains: q, mode: 'insensitive' } } },
        { customer: { lastName: { contains: q, mode: 'insensitive' } } },
        { customer: { subType: { contains: q, mode: 'insensitive' } } },
      ];
    }

    this.applyOpsPresetWhere(baseWhere, params?.opsPreset, requestingUser);

    const normalizedUser = normalizeRequestUser(requestingUser);
    if (normalizedUser && this.operationalAccessGrants?.isDelegationScopedRole(normalizedUser.roleCode)) {
      const delegationWhere = await this.operationalAccessGrants.buildClaimFileDelegationScope(
        normalizedUser.id,
        normalizedUser.roleCode,
      );
      Object.assign(baseWhere, delegationWhere);
    }

    const where = applyClaimFileListScope(
      baseWhere,
      requestingUser,
      params?.insuranceCompanyIds,
    ) as any;

    const orderBy = this.parseSort(params?.sort);

    // select: yerel DB’de henüz migrate edilmemiş skaler kolonlara (ör. assigned_inspector_vendor_id) dayanmamak için
    const [data, total] = await Promise.all([
      this.prisma.claimFile.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          fileNo: true,
          claimNo: true,
          insuredName: true,
          priority: true,
          lossType: true,
          notificationDate: true,
          incidentDate: true,
          createdAt: true,
          updatedAt: true,
          slaDueAt: true,
          invoicedAmount: true,
          insuranceCompany: { select: { id: true, name: true, contactEmail: true } },
          currentStatus: { select: { id: true, code: true, name: true, color: true } },
          customer: {
            select: {
              id: true,
              fullName: true,
              companyName: true,
              firstName: true,
              lastName: true,
              email: true,
              entityType: true,
              subType: true,
            },
          },
          assignedBranch: { select: { id: true, name: true } },
          claimSubject: { select: { id: true, name: true } },
          departmentFileSubject: { select: { id: true, name: true } },
          assignedFieldUser: { select: { id: true, firstName: true, lastName: true } },
          assignedOfficeUser: { select: { id: true, firstName: true, lastName: true } },
          currentResponsibleUser: { select: { id: true, firstName: true, lastName: true } },
          assignedAdjuster: {
            select: {
              id: true, firstName: true, lastName: true,
              adjuster: { select: { id: true, name: true, company: true } },
            },
          },
          invoices: {
            select: { id: true, status: true, invoiceType: true, totalAmount: true },
          },
        },
        orderBy,
      }),
      this.prisma.claimFile.count({ where }),
    ]);

    const dataWithReports = await this.attachLatestRepairReports(data);
    const enriched = await this.enrichOperationFields(dataWithReports);

    return {
      data: enriched,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  private async countForOpsPreset(
    opsPreset: OperationPreset,
    requestingUser?: { id: string; roleCode: string },
  ): Promise<number> {
    const baseWhere: Record<string, unknown> = {};
    this.applyOpsPresetWhere(baseWhere, opsPreset, requestingUser);

    const normalizedUser = normalizeRequestUser(requestingUser);
    if (normalizedUser && this.operationalAccessGrants?.isDelegationScopedRole(normalizedUser.roleCode)) {
      const delegationWhere = await this.operationalAccessGrants.buildClaimFileDelegationScope(
        normalizedUser.id,
        normalizedUser.roleCode,
      );
      Object.assign(baseWhere, delegationWhere);
    }

    const where = applyClaimFileListScope(baseWhere, requestingUser) as any;
    return this.prisma.claimFile.count({ where });
  }

  /** Operasyon sayfası KPI sayaçları — tek round-trip */
  async getOperationStats(requestingUser?: { id: string; roleCode: string }) {
    const [
      open,
      urgent,
      openedToday,
      approvalPending,
      reportWriting,
      reportApproval,
      financeTransfer,
      delayRisk,
      approval72h,
    ] = await Promise.all([
      this.countForOpsPreset('open', requestingUser),
      this.countForOpsPreset('urgent', requestingUser),
      this.countForOpsPreset('opened_today', requestingUser),
      this.countForOpsPreset('approval_pending', requestingUser),
      this.countForOpsPreset('report_writing', requestingUser),
      this.countForOpsPreset('report_approval', requestingUser),
      this.countForOpsPreset('finance_transfer', requestingUser),
      this.countForOpsPreset('delay_risk', requestingUser),
      this.countForOpsPreset('approval_72h', requestingUser),
    ]);

    return {
      open,
      urgent,
      openedToday,
      approvalPending,
      reportWriting,
      reportApproval,
      financeTransfer,
      delayRisk,
      approval72h,
    };
  }

  private async enrichOperationFields<T extends { id: string; currentStatus?: { code?: string; name?: string } | null; priority?: string | null; slaDueAt?: Date | null; assignedOfficeUser?: { firstName?: string; lastName?: string } | null; assignedFieldUser?: { firstName?: string; lastName?: string } | null; currentResponsibleUser?: { firstName?: string; lastName?: string } | null; latestRepairReport?: { status?: string; updatedAt?: Date | string } | null; updatedAt?: Date }>(
    claims: T[],
  ) {
    if (!claims.length) return claims;
    const now = new Date();
    const reportIds = claims
      .map((c) => (c as any).latestRepairReport?.id as string | undefined)
      .filter((id): id is string => Boolean(id));

    const awaitingByReport = new Map<string, Date>();
    if (reportIds.length) {
      const histories = await this.prisma.reportApprovalHistory.findMany({
        where: {
          reportId: { in: reportIds },
          action: { in: ['pending_approval', 'submitted'] },
        },
        orderBy: { createdAt: 'desc' },
        select: { reportId: true, createdAt: true },
      });
      for (const h of histories) {
        if (!awaitingByReport.has(h.reportId)) awaitingByReport.set(h.reportId, h.createdAt);
      }
    }

    return claims.map((claim) => {
      const report = (claim as any).latestRepairReport as { id?: string; status?: string; updatedAt?: Date | string } | null;
      const claimCode = claim.currentStatus?.code ?? null;
      const stage = deriveOperationStage({
        claimStatusCode: claimCode,
        reportStatus: report?.status ?? null,
      });
      const awaitingSince =
        report?.id && isApprovalWaitingReport(report.status)
          ? (awaitingByReport.get(report.id) ?? (report.updatedAt ? new Date(report.updatedAt) : null))
          : null;
      const approval72hExceeded = Boolean(
        awaitingSince && isApproval72hExceeded(awaitingSince, now),
      );
      const approvalWaitingHours = hoursSince(awaitingSince, now);
      const assignee =
        claim.assignedOfficeUser
          ? `${claim.assignedOfficeUser.firstName ?? ''} ${claim.assignedOfficeUser.lastName ?? ''}`.trim()
          : claim.currentResponsibleUser
            ? `${claim.currentResponsibleUser.firstName ?? ''} ${claim.currentResponsibleUser.lastName ?? ''}`.trim()
            : claim.assignedFieldUser
              ? `${claim.assignedFieldUser.firstName ?? ''} ${claim.assignedFieldUser.lastName ?? ''}`.trim()
              : null;
      const delayRisk =
        approval72hExceeded
        || (claim.slaDueAt != null && new Date(claim.slaDueAt).getTime() < now.getTime());

      return {
        ...claim,
        operationStage: stage,
        operationStatusLabel: approval72hExceeded ? 'Onay Talep Et' : stage.label,
        nextAction: approval72hExceeded ? 'Onay Talep Et' : stage.nextAction,
        approval72hExceeded,
        approvalWaitingHours,
        assigneeName: assignee || null,
        delayRisk,
      };
    });
  }

  private async attachLatestRepairReports<T extends { id: string }>(claims: T[]) {
    if (!claims.length) return claims;
    const ids = claims.map((c) => c.id);
    const reports = await this.prisma.repairReport.findMany({
      where: { claimFileId: { in: ids } },
      orderBy: { updatedAt: 'desc' },
      select: LATEST_REPAIR_REPORT_SELECT,
    });
    const latestByClaim = pickPreferredRepairReportsByClaim(reports);
    return claims.map((claim) => {
      const latest = latestByClaim.get(claim.id);
      return {
        ...claim,
        latestRepairReport: latest ? formatLatestRepairReport(latest) : null,
      };
    });
  }

  async findOne(id: string, requestingUser?: { id: string; roleCode: string }) {
    const claimFile = await this.prisma.claimFile.findUnique({
      where: { id },
      include: {
        insuranceCompany: true,
        currentStatus: true,
        customer: true,
        propertyAddress: true,
        assignedBranch: true,
        assignedFieldUser: { select: { id: true, firstName: true, lastName: true } },
        assignedOfficeUser: { select: { id: true, firstName: true, lastName: true } },
        assignedSupplier: { select: { id: true, name: true, city: true, district: true, type: true, phone: true, authorizedPhone: true } },
        supplierAssignments: {
          orderBy: [{ sortOrder: 'asc' }, { assignedAt: 'asc' }],
          include: {
            vendor: {
              select: {
                id: true, name: true, city: true, district: true, type: true,
                phone: true, authorizedPhone: true,
              },
            },
          },
        },
        assignedInspectorVendor: {
          select: {
            id: true, name: true, city: true, district: true, type: true,
            phone: true, authorizedPhone: true, canActAsInspector: true,
          },
        },
        currentResponsibleUser: { select: { id: true, firstName: true, lastName: true } },
        assignedAdjuster: { select: { id: true, firstName: true, lastName: true } },
        department: { select: { id: true, code: true, name: true, reportFormat: true, color: true } },
        claimSubject: { select: { id: true, name: true } },
        departmentFileSubject: { select: { id: true, name: true } },
        statusHistory: {
          include: {
            fromStatus: true,
            toStatus: true,
            changedByUser: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { changedAt: 'desc' },
          take: 10,
        },
        financialSummary: {
          select: {
            actualCost: true,
            totalCost: true,
            actualRevenue: true,
            totalRevenue: true,
            totalCollected: true,
          },
        },
      },
    });

    if (!claimFile) {
      throw new NotFoundException('Hasar dosyası bulunamadı');
    }

    const normalizedUser = normalizeRequestUser(requestingUser);
    let insuranceCompanyIds: string[] | undefined;
    if (normalizedUser && normalizedUser.roleCode === 'insurance_company_user') {
      insuranceCompanyIds = await this.getInsuranceScopes(normalizedUser.id);
    }
    assertClaimFileAccess(claimFile, normalizedUser, insuranceCompanyIds);

    if (normalizedUser && this.operationalAccessGrants?.isDelegationScopedRole(normalizedUser.roleCode)) {
      const assignedId = claimFile.assignedOfficeUserId;
      if (assignedId && assignedId !== normalizedUser.id) {
        const viaDelegation = await this.operationalAccessGrants.canAccessAssignedUserViaDelegation(
          normalizedUser.id,
          assignedId,
          'hasar',
        );
        if (!viaDelegation) {
          throw new ForbiddenException('Bu dosyaya erişim izniniz bulunmamaktadır');
        }
      } else if (!assignedId) {
        const createdBySelf = await this.prisma.claimStatusHistory.findFirst({
          where: {
            claimFileId: claimFile.id,
            changedByUserId: normalizedUser.id,
            note: 'Dosya oluşturuldu',
          },
          select: { id: true },
        });
        if (!createdBySelf) {
          throw new ForbiddenException('Bu dosyaya erişim izniniz bulunmamaktadır');
        }
      }
    }

    if (normalizedUser?.roleCode === 'expert') {
      const hasExpertAccess =
        claimFile.assignedAdjusterId === normalizedUser.id ||
        (claimFile.sourceChannel === 'expert_portal' &&
          (await this.prisma.repairReport.findFirst({
            where: { claimFileId: id, createdByUserId: normalizedUser.id },
            select: { id: true },
          })));
      if (!hasExpertAccess) {
        throw new ForbiddenException('Bu dosyaya erişim izniniz bulunmamaktadır');
      }
    }

    const reports = await this.prisma.repairReport.findMany({
      where: { claimFileId: id },
      orderBy: { updatedAt: 'desc' },
      select: LATEST_REPAIR_REPORT_SELECT,
    });
    const latestReport = pickPreferredRepairReport(reports);

    const activeDelegation = normalizedUser && this.operationalAccessGrants
      ? await this.operationalAccessGrants.resolveDelegationBanner(
          normalizedUser.id,
          claimFile.assignedOfficeUserId,
          'hasar',
        )
      : null;

    const earliestInbound = await this.prisma.inboundMessage.findFirst({
      where: { claimFileId: id },
      orderBy: { receivedAt: 'asc' },
      select: { receivedAt: true },
    });

    return {
      ...claimFile,
      assignedSuppliers: (claimFile.supplierAssignments ?? []).map((s) => s.vendor),
      inboundReceivedAt: earliestInbound?.receivedAt ?? null,
      latestRepairReport: latestReport ? formatLatestRepairReport(latestReport) : null,
      activeDelegation,
      financialVisibilityConfig: resolveFinancialVisibilityConfig(claimFile),
      canViewFinancials: requestingUser
        ? canViewFileFinancials(requestingUser, claimFile)
        : true,
      canManageFinancialVisibility: requestingUser
        ? canManageFinancialVisibility(requestingUser.roleCode)
        : false,
    };
  }

  private async resolveInsuredNameForCreate(
    explicit: string | null,
    customerId: string | null,
  ): Promise<string | null> {
    const trimmed = explicit?.trim();
    if (trimmed) return trimmed;

    if (!customerId) return null;

    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { entityType: true, fullName: true, firstName: true, lastName: true },
    });
    if (!customer) return null;

    const entityType = String(customer.entityType ?? '').trim().toLowerCase();
    if (entityType === 'corporate') return null;

    const composed = [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim()
      || customer.fullName?.trim()
      || '';
    return composed || null;
  }

  async create(
    data: any,
    requestingUser?: { id?: string; userId?: string; roleCode?: string; role?: { code?: string } },
  ) {
    const { fileNo: userFileNo, propertyAddress: _pa, city: _city, district: _district, ...rest } = data;
    const fileNo = (typeof userFileNo === 'string' && userFileNo.trim()) ? userFileNo.trim() : '';

    if (!fileNo) {
      throw new BadRequestException('Dosya numarası zorunludur');
    }

    // currentStatusId yoksa otomatik 'new' durumunu bul
    let currentStatusId = rest.currentStatusId;
    if (!currentStatusId) {
      const defaultStatus = await this.prisma.claimStatus.findFirst({
        where: { code: 'new' },
      });
      if (!defaultStatus) {
        throw new BadRequestException('Varsayılan durum (new) bulunamadı. Lütfen sistem yöneticisiyle iletişime geçin.');
      }
      currentStatusId = defaultStatus.id;
    }

    // Dosya numarası benzersizlik kontrolü
    const existingFile = await this.prisma.claimFile.findUnique({ where: { fileNo } });
    if (existingFile) {
      throw new BadRequestException('Bu dosya numarası zaten kullanılıyor');
    }

    const insuranceCompanyId = typeof rest.insuranceCompanyId === 'string' ? rest.insuranceCompanyId.trim() : '';
    const sourceChannel = typeof rest.sourceChannel === 'string' ? rest.sourceChannel.trim() : '';
    let policyNo = typeof rest.policyNo === 'string' ? rest.policyNo.trim() : '';
    const claimNo = typeof rest.claimNo === 'string' ? rest.claimNo.trim() : '';
    const productBranch = typeof rest.productBranch === 'string' ? rest.productBranch.trim() : '';
    let lossType = typeof rest.lossType === 'string' ? rest.lossType.trim() : '';
    lossType = sanitizeInboundLossType(lossType);

    // Domain Ayrıştırma: claimSubjectId tercih, departmentFileSubjectId backward-compat
    let claimSubjectId = rest.claimSubjectId ?? null;
    let departmentFileSubjectId = rest.departmentFileSubjectId ?? null;
    const departmentId = rest.departmentId ?? null;

    if (!insuranceCompanyId) throw new BadRequestException('Sigorta şirketi zorunludur');
    if (!policyNo) {
      if (sourceChannel === 'expert_portal') {
        policyNo = 'Belirtilmedi';
      } else {
        throw new BadRequestException('Poliçe numarası zorunludur');
      }
    }
    if (!claimNo) throw new BadRequestException('Hasar numarası zorunludur');
    if (!productBranch) throw new BadRequestException('Ürün branşı zorunludur');
    if (!lossType) throw new BadRequestException('Hasar türü zorunludur');

    if (!claimSubjectId && lossType !== 'Belirtilmemiş') {
      claimSubjectId = await resolveClaimSubjectIdByLabel(this.prisma, lossType);
    }

    const insuredName = await this.resolveInsuredNameForCreate(
      typeof rest.insuredName === 'string' ? rest.insuredName : null,
      rest.customerId ?? null,
    );
    if (sourceChannel !== 'expert_portal' && !insuredName) {
      throw new BadRequestException('Sigortalı adı soyadı zorunludur');
    }

    let propertyAddressId = rest.propertyAddressId ?? null;
    const propertyAddressText = typeof data.propertyAddress === 'string' ? data.propertyAddress.trim() : '';
    if (!propertyAddressId && propertyAddressText) {
      const city = typeof data.city === 'string' ? data.city.trim() || '' : '';
      const district = typeof data.district === 'string' ? data.district.trim() || '' : '';
      const address = await this.prisma.address.create({
        data: {
          city: city || 'Belirtilmemiş',
          district: district || undefined,
          addressLine: propertyAddressText,
        },
      });
      propertyAddressId = address.id;
    }

    try {
      const expertUserId = requestingUser?.id ?? requestingUser?.userId;
      const roleCode = requestingUser?.roleCode ?? requestingUser?.role?.code;
      const assignedAdjusterId =
        sourceChannel === 'expert_portal' && roleCode === 'expert' && expertUserId
          ? expertUserId
          : rest.assignedAdjusterId ?? null;

      let assignedOfficeUserId = rest.assignedOfficeUserId ?? null;
      let resolvedDepartmentId = departmentId ?? null;
      if (!resolvedDepartmentId && sourceChannel !== 'expert_portal') {
        resolvedDepartmentId = await this.resolveHasarDepartmentId();
      }

      const normalizedRoleCode = String(roleCode ?? '').trim().toLowerCase();
      if (
        !assignedOfficeUserId
        && !rest.assignedFieldUserId
        && expertUserId
        && this.operationalAccessGrants?.isDelegationScopedRole(normalizedRoleCode)
      ) {
        assignedOfficeUserId = expertUserId;
      }

      if (
        sourceChannel === 'expert_portal'
        && !assignedOfficeUserId
        && !rest.assignedFieldUserId
      ) {
        const city = typeof data.city === 'string' ? data.city.trim() : '';
        const district = typeof data.district === 'string' ? data.district.trim() : undefined;
        const resolved = await this.resolveExpertPortalOfficeUserId({
          insuranceCompanyId,
          city,
          district,
          departmentId: resolvedDepartmentId,
          claimSubjectId,
        });
        assignedOfficeUserId = resolved.officeUserId;
        if (!resolvedDepartmentId && resolved.departmentId) {
          resolvedDepartmentId = resolved.departmentId;
        }
      }

      if (!departmentFileSubjectId && lossType !== 'Belirtilmemiş') {
        const deptSubject = await resolveDepartmentFileSubjectByLabel(
          this.prisma,
          lossType,
          resolvedDepartmentId,
        );
        if (deptSubject) {
          departmentFileSubjectId = deptSubject.id;
          lossType = deptSubject.name;
          if (!claimSubjectId) {
            claimSubjectId = await resolveClaimSubjectIdByLabel(this.prisma, lossType);
          }
        }
      }

      const created = await this.prisma.claimFile.create({
        data: {
          ...rest,
          insuredName,
          assignedAdjusterId,
          assignedOfficeUserId,
          insuranceCompanyId,
          policyNo,
          claimNo,
          productBranch,
          lossType,
          propertyAddressId,
          fileNo,
          currentStatusId,
          claimSubjectId,
          departmentFileSubjectId,
          departmentId: resolvedDepartmentId,
          currentResponsibleRole: assignedOfficeUserId ? 'operasyon_sorumlusu' : null,
          currentResponsibleUserId: assignedOfficeUserId ?? null,
          lastActivityAt: new Date(),
          lastHumanActionAt: new Date(),
        },
        include: {
          insuranceCompany: true,
          currentStatus: true,
          customer: true,
          propertyAddress: true,
          assignedFieldUser: { select: { id: true, firstName: true, lastName: true, email: true } },
          assignedOfficeUser: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });

      const historyUserId =
        expertUserId ?? created.assignedOfficeUserId ?? created.assignedFieldUserId ?? null;
      if (historyUserId) {
        await this.prisma.claimStatusHistory.create({
          data: {
            claimFileId: created.id,
            toStatusId: currentStatusId,
            changedByUserId: historyUserId,
            note:
              sourceChannel === 'expert_portal'
                ? 'Eksper portal ihbarı ile açıldı'
                : 'Dosya oluşturuldu',
          },
        });
        if (sourceChannel === 'expert_portal' && expertUserId) {
          await this.logActivity({
            claimFileId: created.id,
            action: 'STATUS_CHANGED',
            actorId: expertUserId,
            actorRole: roleCode ?? 'expert',
            description: 'Eksper portalından yeni ihbar kaydı açıldı.',
          });
        }
      }

      // In-app bildirim: Yeni dosya oluşturuldu, saha/ofis personeline bildir
      const customerName =
        (created.customer as any)?.fullName ??
        (created.customer as any)?.companyName ??
        'Bilinmiyor';
      const addressText = (created as any)?.propertyAddress?.addressLine ?? '';
      const notifTitle =
        sourceChannel === 'expert_portal' ? 'Eksper Portal İhbarı' : 'Yeni Dosya Atandı';
      const notifBody =
        sourceChannel === 'expert_portal'
          ? `Eksper portalından yeni ihbar: ${created.fileNo} - ${customerName}${addressText ? ' - ' + addressText : ''}`
          : `Yeni dosya atandı: ${created.fileNo} - ${customerName}${addressText ? ' - ' + addressText : ''}`;

      const notifTargets: Array<{ id: string }> = [];
      if (created.assignedFieldUserId) notifTargets.push({ id: created.assignedFieldUserId });
      if (created.assignedOfficeUserId && created.assignedOfficeUserId !== created.assignedFieldUserId) {
        notifTargets.push({ id: created.assignedOfficeUserId });
      }
      for (const t of notifTargets) {
        void this.createInAppNotification({
          userId: t.id,
          type: 'file_assignment',
          title: notifTitle,
          body: notifBody,
          relatedEntityId: created.id,
        });
      }

      // Email: Yeni dosya oluşturma bildirimi
      if (this.claimEventEmail) {
        const recipients: Array<{ id: string; email: string }> = [];
        if (created.assignedFieldUser && (created.assignedFieldUser as any).email) {
          recipients.push({ id: created.assignedFieldUserId!, email: (created.assignedFieldUser as any).email });
        }
        if (created.assignedOfficeUser && (created.assignedOfficeUser as any).email) {
          recipients.push({ id: created.assignedOfficeUserId!, email: (created.assignedOfficeUser as any).email });
        }
        for (const r of recipients) {
          void this.claimEventEmail.onNewClaimFile({
            recipientEmail: r.email,
            recipientUserId: r.id,
            fileNo: created.fileNo,
            customer: customerName,
            branch: created.productBranch,
            priority: created.priority,
            claimFileId: created.id,
          });
        }
      }

      this.cache.invalidatePattern('cache:dashboard:*').catch(() => {});
      return created;
    } catch (err: any) {
      if (err?.code === 'P2002' && err?.meta?.target?.includes('file_no')) {
        throw new BadRequestException('Bu dosya numarası zaten kullanılıyor');
      }
      throw err;
    }
  }

  async update(id: string, data: any, requestingUser?: { id: string; roleCode?: string | null }) {
    const existing = await this.findOne(id);
    const existingAny = existing as {
      departmentId?: string | null;
      propertyAddressId?: string | null;
      propertyAddress?: {
        id: string;
        city?: string | null;
        district?: string | null;
        addressLine?: string | null;
      } | null;
      assignedOfficeUserId?: string | null;
    };

    const {
      city: rawCity,
      district: rawDistrict,
      propertyAddress: rawPropertyAddress,
      addressLine: rawAddressLine,
      ...rest
    } = data ?? {};

    if (rest.financialVisibilityConfig !== undefined) {
      if (!canManageFinancialVisibility(requestingUser?.roleCode)) {
        throw new ForbiddenException('Finansal görünürlük ayarını yalnızca yönetici değiştirebilir');
      }
      rest.financialVisibilityConfig = normalizeFinancialVisibilityConfig(rest.financialVisibilityConfig);
      rest.hideFinancialFromAssignees = false;
    }

    if (rest.hideFinancialFromAssignees !== undefined && rest.hideFinancialFromAssignees !== false) {
      if (!canManageFinancialVisibility(requestingUser?.roleCode)) {
        throw new ForbiddenException('Finansal görünürlük ayarını yalnızca yönetici değiştirebilir');
      }
    }

    // fileNo değiştirilmeye çalışılıyorsa çakışma kontrolü
    if (rest.fileNo?.trim()) {
      const { exists } = await this.checkFileNo(rest.fileNo.trim(), id, 'hasar');
      if (exists) {
        throw new ConflictException('Bu dosya numarası zaten kullanılıyor');
      }
    }

    if (typeof rest.insuredName === 'string') {
      const trimmed = rest.insuredName.trim();
      rest.insuredName = trimmed || null;
    }

    if (typeof rest.insuredPhone === 'string') {
      const digits = rest.insuredPhone.replace(/\D/g, '');
      rest.insuredPhone = digits || null;
    }

    if (typeof rest.policyNo === 'string') {
      rest.policyNo = rest.policyNo.trim();
    }

    if (typeof rest.description === 'string') {
      rest.description = rest.description.trim() || null;
    }

    if (typeof rest.priority === 'string') {
      const p = rest.priority.trim().toLowerCase();
      rest.priority = p || undefined;
    }

    if (typeof rest.lossType === 'string') {
      rest.lossType = sanitizeInboundLossType(rest.lossType.trim());
      if (!rest.departmentFileSubjectId && rest.lossType !== 'Belirtilmemiş') {
        const deptSubject = await resolveDepartmentFileSubjectByLabel(
          this.prisma,
          rest.lossType,
          rest.departmentId ?? existingAny.departmentId ?? null,
        );
        if (deptSubject) {
          rest.departmentFileSubjectId = deptSubject.id;
          rest.lossType = deptSubject.name;
        }
      }
      if (!rest.claimSubjectId && rest.lossType && rest.lossType !== 'Belirtilmemiş') {
        const subjectId = await resolveClaimSubjectIdByLabel(this.prisma, rest.lossType);
        if (subjectId) rest.claimSubjectId = subjectId;
      }
    }

    const addressTouched =
      rawCity !== undefined || rawDistrict !== undefined || rawPropertyAddress !== undefined || rawAddressLine !== undefined;
    if (addressTouched) {
      const nextCity =
        typeof rawCity === 'string'
          ? rawCity.trim()
          : (existingAny.propertyAddress?.city ?? '');
      const nextDistrict =
        typeof rawDistrict === 'string'
          ? rawDistrict.trim() || null
          : (existingAny.propertyAddress?.district ?? null);
      const nextLineRaw =
        typeof rawPropertyAddress === 'string'
          ? rawPropertyAddress
          : typeof rawAddressLine === 'string'
            ? rawAddressLine
            : (existingAny.propertyAddress?.addressLine ?? '');
      const nextLine = String(nextLineRaw).trim();

      if (existingAny.propertyAddressId) {
        await this.prisma.address.update({
          where: { id: existingAny.propertyAddressId },
          data: {
            city: nextCity || 'Belirtilmemiş',
            district: nextDistrict || null,
            ...(nextLine ? { addressLine: nextLine } : {}),
          },
        });
      } else if (nextLine || nextCity) {
        const createdAddress = await this.prisma.address.create({
          data: {
            city: nextCity || 'Belirtilmemiş',
            district: nextDistrict || undefined,
            addressLine: nextLine || [nextCity, nextDistrict].filter(Boolean).join(' / ') || 'Belirtilmemiş',
          },
        });
        rest.propertyAddressId = createdAddress.id;
      }
    }

    if (rest.assignedOfficeUserId !== undefined) {
      const officeId =
        typeof rest.assignedOfficeUserId === 'string' && rest.assignedOfficeUserId.trim()
          ? rest.assignedOfficeUserId.trim()
          : null;
      rest.assignedOfficeUserId = officeId;
      if (officeId && officeId !== existingAny.assignedOfficeUserId) {
        rest.currentResponsibleRole = 'operasyon_sorumlusu';
        rest.currentResponsibleUserId = officeId;
      }
    }

    if (rest.customerId !== undefined) {
      rest.customerId =
        typeof rest.customerId === 'string' && rest.customerId.trim()
          ? rest.customerId.trim()
          : null;
    }

    // Eşzamanlı düzenleme koruması (optimistic concurrency)
    const expectedUpdatedAt = rest.expectedUpdatedAt ?? rest.expected_updated_at;
    delete rest.expectedUpdatedAt;
    delete rest.expected_updated_at;
    if (expectedUpdatedAt) {
      const expectedMs = new Date(String(expectedUpdatedAt)).getTime();
      const currentMs = new Date((existing as { updatedAt?: Date }).updatedAt as Date).getTime();
      if (!Number.isNaN(expectedMs) && currentMs !== expectedMs) {
        throw new ConflictException(
          'Bu dosya başka bir kullanıcı tarafından güncellendi. Sayfayı yenileyip tekrar deneyin.',
        );
      }
    }

    // Prisma'ya gitmeyen / sahte alanları temizle
    delete rest.approvalStatus;
    delete rest.rejectionReason;
    delete rest.propertyAddress;
    delete rest.customer;
    delete rest.assignedOfficeUser;
    delete rest.claimSubject;
    delete rest.departmentFileSubject;
    delete rest.currentStatus;

    const updated = await this.prisma.claimFile.update({
      where: { id },
      data: rest,
      include: {
        currentStatus: true,
        propertyAddress: true,
        customer: true,
        assignedOfficeUser: { select: { id: true, firstName: true, lastName: true, email: true } },
        claimSubject: { select: { id: true, name: true } },
        departmentFileSubject: { select: { id: true, name: true } },
      },
    });
    this.cache.invalidatePattern('cache:dashboard:*').catch(() => {});
    return updated;
  }

  async remove(id: string) {
    await this.findOne(id);
    throw new BadRequestException(
      'Hasar dosyası kalıcı olarak silinemez. Dosyayı kapatma veya iptal durum akışı ile pasifleştirin.',
    );
  }

  async assign(id: string, dto: any) {
    const claimFile = await this.findOne(id);

    const updateData: any = {};
    if (dto.assignedFieldUserId !== undefined) {
      updateData.assignedFieldUserId = dto.assignedFieldUserId;
      if (dto.assignedFieldUserId) {
        updateData.assignedInspectorVendorId = null;
        updateData.inspectorAssignedAt = null;
      }
    }
    if (dto.assignedOfficeUserId !== undefined) updateData.assignedOfficeUserId = dto.assignedOfficeUserId;
    if (dto.assignedAdjusterId !== undefined) updateData.assignedAdjusterId = dto.assignedAdjusterId;
    if (dto.assignedBranchId !== undefined) updateData.assignedBranchId = dto.assignedBranchId;

    const updated = await this.prisma.claimFile.update({
      where: { id },
      data: updateData,
      include: {
        customer: true,
        assignedFieldUser: { select: { id: true, firstName: true, lastName: true, email: true } },
        assignedOfficeUser: { select: { id: true, firstName: true, lastName: true, email: true } },
        assignedAdjuster: { select: { id: true, firstName: true, lastName: true, email: true } },
        assignedBranch: true,
      },
    });
    this.auditLogsService.log({
      entityType: 'DamageFile',
      entityId: id,
      action: 'UPDATE',
      oldValue: {
        assignedFieldUserId: (claimFile as any).assignedFieldUserId ?? null,
        assignedOfficeUserId: (claimFile as any).assignedOfficeUserId ?? null,
        assignedAdjusterId: (claimFile as any).assignedAdjusterId ?? null,
      },
      newValue: {
        assignedFieldUserId: (updated as any).assignedFieldUserId ?? null,
        assignedOfficeUserId: (updated as any).assignedOfficeUserId ?? null,
        assignedAdjusterId: (updated as any).assignedAdjusterId ?? null,
      },
      userId: dto.userId ?? 'system',
    });

    // In-app bildirim: Saha/ofis personeline atama bildirimi
    {
      const customerName =
        (updated.customer as any)?.fullName ??
        (updated.customer as any)?.companyName ??
        'Bilinmiyor';
      const propertyAddr = (updated as any)?.propertyAddress?.addressLine ?? '';
      const fileNo = (updated as any).fileNo ?? (claimFile as any).fileNo;
      const notifBody = `Yeni dosya atandı: ${fileNo} - ${customerName}${propertyAddr ? ' - ' + propertyAddr : ''}`;

      if (dto.assignedFieldUserId && updated.assignedFieldUser) {
        void this.createInAppNotification({
          userId: (updated.assignedFieldUser as any).id,
          type: 'file_assignment',
          title: 'Yeni Dosya Atandı',
          body: notifBody,
          relatedEntityId: id,
        });
      }
      if (dto.assignedOfficeUserId && updated.assignedOfficeUser) {
        void this.createInAppNotification({
          userId: (updated.assignedOfficeUser as any).id,
          type: 'file_assignment',
          title: 'Dosya Atandı',
          body: notifBody,
          relatedEntityId: id,
        });
      }
    }

    // Email: Atama bildirimi
    if (this.claimEventEmail) {
      const customerName =
        (updated.customer as any)?.fullName ??
        (updated.customer as any)?.companyName ??
        'Bilinmiyor';

      const newAssignees: Array<{ id: string; email: string; name: string }> = [];
      if (dto.assignedFieldUserId && updated.assignedFieldUser) {
        const u = updated.assignedFieldUser as any;
        if (u.email) newAssignees.push({ id: u.id, email: u.email, name: `${u.firstName} ${u.lastName}` });
      }
      if (dto.assignedOfficeUserId && updated.assignedOfficeUser) {
        const u = updated.assignedOfficeUser as any;
        if (u.email) newAssignees.push({ id: u.id, email: u.email, name: `${u.firstName} ${u.lastName}` });
      }

      for (const a of newAssignees) {
        void this.claimEventEmail.onClaimAssigned({
          recipientEmail: a.email,
          recipientUserId: a.id,
          fileNo: (claimFile as any).fileNo,
          customer: customerName,
          assigneeName: a.name,
          claimFileId: id,
        });
      }
    }

    // SMS: Sigortalıya atama bildirim SMS'i gönder
    if (this.smsService && this.templateService) {
      const customer = updated.customer as any;
      const customerPhone: string | undefined = customer?.phone;

      if (customerPhone) {
        void (async () => {
          try {
            const template = await this.templateService!.getByType(TEMPLATE_TYPES.SMS_ASSIGNMENT);

            if (template.isActive) {
              // Şirket bilgilerini SystemSettings'den al (varsa)
              const companySetting = await this.prisma.systemSetting.findUnique({
                where: { key: 'company_info' },
              });
              const companyInfo = (companySetting?.value ?? {}) as Record<string, string>;

              const customerName2 =
                (customer?.fullName ??
                customer?.companyName ??
                `${customer?.firstName ?? ''} ${customer?.lastName ?? ''}`.trim()) ||
                'Sayın Müşteri';

              const message = this.templateService!.interpolate(template.content, {
                musteriAdi: customerName2,
                dosyaNo: (updated as any).fileNo,
                sirketAdi: companyInfo['name'] ?? 'Şirketimiz',
                sirketTelefon: companyInfo['phone'] ?? '',
              });

              await this.smsService!.sendCustomerAssignmentSms({
                to: customerPhone,
                claimFileId: id,
                templateContent: message,
              });
            }
          } catch (err: any) {
            this.logger.warn(`[ClaimFiles] Atama SMS tetikleyici hatası: ${err?.message}`);
          }
        })();
      }
    }

    this.cache.invalidatePattern('cache:dashboard:*').catch(() => {});
    return updated;
  }

  async changeStatus(id: string, dto: { toStatusId: string; note?: string }, userId: string) {
    const claimFile = await this.findOne(id);

    const fromStatus = claimFile.currentStatus as any;
    const toStatus = await this.prisma.claimStatus.findUnique({
      where: { id: dto.toStatusId },
    });

    if (!toStatus) {
      throw new BadRequestException('Hedef durum bulunamadı');
    }

    const allowedTransitions = STATUS_TRANSITIONS[fromStatus.code] ?? [];
    if (!allowedTransitions.includes(toStatus.code)) {
      throw new BadRequestException(
        `'${fromStatus.name}' durumundan '${toStatus.name}' durumuna geçiş yapılamaz`,
      );
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.claimFile.update({
        where: { id },
        data: {
          currentStatusId: dto.toStatusId,
          ...(toStatus.isClosedState ? { closedAt: new Date() } : {}),
        },
        include: { currentStatus: true },
      }),
      this.prisma.claimStatusHistory.create({
        data: {
          claimFileId: id,
          fromStatusId: fromStatus.id,
          toStatusId: dto.toStatusId,
          changedByUserId: userId,
          note: dto.note,
        },
      }),
    ]);
    this.auditLogsService.log({
      entityType: 'DamageFile',
      entityId: id,
      action: 'STATUS_CHANGE',
      oldValue: { statusId: fromStatus.id, statusCode: fromStatus.code, statusName: fromStatus.name },
      newValue: { statusId: toStatus.id, statusCode: toStatus.code, statusName: toStatus.name, note: dto.note ?? null },
      userId,
    });

    // Email: Dosya kapandı
    if (toStatus.isClosedState && this.claimEventEmail) {
      const fullFile = claimFile as any;
      const closedAt = new Date().toLocaleDateString('tr-TR');

      // Yönetici ve atanmış personele bildirim
      const emailTargets: Array<{ userId: string; email: string }> = [];
      if (fullFile.assignedOfficeUser?.email) {
        emailTargets.push({ userId: fullFile.assignedOfficeUserId, email: fullFile.assignedOfficeUser.email });
      }
      if (fullFile.assignedFieldUser?.email) {
        emailTargets.push({ userId: fullFile.assignedFieldUserId, email: fullFile.assignedFieldUser.email });
      }

      const customerName =
        fullFile.customer?.fullName ?? fullFile.customer?.companyName ?? 'Bilinmiyor';

      for (const target of emailTargets) {
        void this.claimEventEmail.onClaimClosed({
          recipientEmail: target.email,
          recipientUserId: target.userId,
          fileNo: (claimFile as any).fileNo,
          customer: customerName,
          closedAt,
          claimFileId: id,
        });
      }

      // Müşteriye bildirim (email varsa)
      if (fullFile.customer?.email) {
        void this.claimEventEmail.onClaimClosed({
          recipientEmail: fullFile.customer.email,
          recipientUserId: fullFile.customer.id ?? 'customer',
          fileNo: (claimFile as any).fileNo,
          customer: customerName,
          closedAt,
          claimFileId: id,
        });
      }

      // In-app bildirim: Atanmış personele dosya kapandı bildirimi
      const fileNo = (claimFile as any).fileNo;
      const closeNotifBody = `Dosya kapatıldı: ${fileNo} - ${customerName}`;
      const closeNotifTargets: string[] = [];
      if (fullFile.assignedFieldUserId) closeNotifTargets.push(fullFile.assignedFieldUserId);
      if (fullFile.assignedOfficeUserId) closeNotifTargets.push(fullFile.assignedOfficeUserId);
      for (const uid of [...new Set(closeNotifTargets)]) {
        void this.createInAppNotification({
          userId: uid,
          type: 'file_closed',
          title: 'Dosya Kapatıldı',
          body: closeNotifBody,
          relatedEntityId: id,
        });
      }

      void this.vendorProfile?.onFileCompleted({ type: 'claim_file', id }).catch((err) =>
        this.logger.warn(`[VendorIntelligenceProfile] Kapanış hook: ${err?.message}`),
      );
    }

    return updated;
  }

  async getTimeline(id: string) {
    await this.findOne(id);

    const history = await this.prisma.claimStatusHistory.findMany({
      where: { claimFileId: id },
      include: {
        fromStatus: true,
        toStatus: true,
        changedByUser: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { changedAt: 'asc' },
    });

    return history;
  }

  async suggestAssigneesByRegion(
    city: string,
    district?: string,
    roleCode: 'office_staff' | 'field_staff' = 'office_staff',
  ) {
    const province = await this.prisma.province.findFirst({
      where: { name: { equals: city, mode: 'insensitive' } },
    });
    if (!province) return [];

    let districtRecord: { id: string } | null = null;
    if (district) {
      districtRecord = await this.prisma.district.findFirst({
        where: {
          provinceId: province.id,
          name: { equals: district, mode: 'insensitive' },
        },
      });
    }

    const serviceAreaWhere: any = { provinceId: province.id };
    if (districtRecord) {
      serviceAreaWhere.OR = [{ districtId: districtRecord.id }, { districtId: null }];
    } else {
      serviceAreaWhere.districtId = null;
    }

    const countKey = roleCode === 'field_staff' ? 'assignedFieldClaimFiles' : 'assignedOfficeClaimFiles';

    const serviceAreas = await this.prisma.userServiceArea.findMany({
      where: serviceAreaWhere,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            role: { select: { id: true, name: true, code: true } },
            _count: {
              select: {
                assignedFieldClaimFiles: {
                  where: { currentStatus: { isClosedState: false } },
                },
                assignedOfficeClaimFiles: {
                  where: { currentStatus: { isClosedState: false } },
                },
              },
            },
          },
        },
        province: { select: { id: true, name: true } },
        district: { select: { id: true, name: true } },
      },
    });

    const userMap = new Map<string, typeof serviceAreas[number]>();
    for (const sa of serviceAreas) {
      const userRole = (sa.user.role?.code ?? '').toLowerCase().replace(/-/g, '_');
      if (userRole !== roleCode) continue;
      const existing = userMap.get(sa.userId);
      if (!existing || (sa.districtId !== null && existing.districtId === null)) {
        userMap.set(sa.userId, sa);
      }
    }

    // Saha personeli: hiç hizmet bölgesi yoksa Türkiye geneli kabul edilir
    if (roleCode === 'field_staff') {
      const nationwide = await this.prisma.user.findMany({
        where: {
          status: { notIn: ['inactive', 'INACTIVE', 'archived', 'ARCHIVED'] },
          role: { code: { in: ['field_staff', 'FIELD_STAFF'] } },
          serviceAreas: { none: {} },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          role: { select: { id: true, name: true, code: true } },
          _count: {
            select: {
              assignedFieldClaimFiles: {
                where: { currentStatus: { isClosedState: false } },
              },
              assignedOfficeClaimFiles: {
                where: { currentStatus: { isClosedState: false } },
              },
            },
          },
        },
        take: 50,
      });
      for (const user of nationwide) {
        if (userMap.has(user.id)) continue;
        userMap.set(user.id, {
          userId: user.id,
          provinceId: province.id,
          districtId: null,
          user,
          province: { id: province.id, name: province.name },
          district: null,
        } as typeof serviceAreas[number]);
      }
    }

    return Array.from(userMap.values())
      .sort((a, b) => {
        const aLoad = a.user._count?.[countKey] ?? 0;
        const bLoad = b.user._count?.[countKey] ?? 0;
        return aLoad - bLoad;
      })
      .slice(0, 5)
      .map((sa) => ({
        user: sa.user,
        province: sa.province,
        district: sa.district,
        activeFileCount: sa.user._count?.[countKey] ?? 0,
      }));
  }

  private async suggestAssigneesFallback(roleCode: 'office_staff' | 'field_staff', limit = 5) {
    const countKey = roleCode === 'field_staff' ? 'assignedFieldClaimFiles' : 'assignedOfficeClaimFiles';
    const roleCodes =
      roleCode === 'field_staff'
        ? ['field_staff', 'FIELD_STAFF']
        : ['office_staff', 'OFFICE_STAFF'];

    const users = await this.prisma.user.findMany({
      where: {
        status: { notIn: ['inactive', 'INACTIVE', 'archived', 'ARCHIVED'] },
        role: { code: { in: roleCodes } },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: { select: { id: true, name: true, code: true } },
        _count: {
          select: {
            assignedFieldClaimFiles: {
              where: { currentStatus: { isClosedState: false } },
            },
            assignedOfficeClaimFiles: {
              where: { currentStatus: { isClosedState: false } },
            },
          },
        },
      },
      take: 50,
    });

    return users
      .sort((a, b) => (a._count[countKey] ?? 0) - (b._count[countKey] ?? 0))
      .slice(0, limit)
      .map((user) => ({
        user,
        province: null,
        district: null,
        activeFileCount: user._count[countKey] ?? 0,
      }));
  }

  async getAssignableStaff(role: 'office_staff' | 'field_staff' = 'office_staff') {
    const roleCodes =
      role === 'field_staff'
        ? ['field_staff', 'FIELD_STAFF']
        : ['office_staff', 'OFFICE_STAFF'];

    return this.prisma.user.findMany({
      where: {
        status: { notIn: ['inactive', 'INACTIVE', 'archived', 'ARCHIVED'] },
        role: { code: { in: roleCodes } },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      take: 200,
    });
  }

  async suggestResponsible(claimFileId: string, role: 'office_staff' | 'field_staff' = 'office_staff') {
    const claimFile = await this.prisma.claimFile.findUnique({
      where: { id: claimFileId },
      include: {
        propertyAddress: true,
      },
    });

    if (!claimFile) throw new NotFoundException('Hasar dosyası bulunamadı');

    let suggestions: Awaited<ReturnType<typeof this.suggestAssigneesByRegion>> = [];
    if (claimFile.propertyAddress) {
      suggestions = await this.suggestAssigneesByRegion(
        claimFile.propertyAddress.city,
        claimFile.propertyAddress.district ?? undefined,
        role,
      );
    }

    if (suggestions.length > 0) return suggestions.slice(0, 3);
    return this.suggestAssigneesFallback(role, 5);
  }

  async getInsuranceScopes(userId: string): Promise<string[]> {
    const scopes = await this.prisma.userInsuranceCompanyScope.findMany({
      where: { userId },
      select: { insuranceCompanyId: true },
    });
    return scopes.map((s) => s.insuranceCompanyId);
  }

  async checkFileNo(
    fileNo: string,
    excludeId?: string,
    excludeType?: 'hasar' | 'acil',
  ): Promise<{ exists: boolean; usedBy: 'hasar' | 'acil' | null; matchedRecord?: { id: string; status?: string } | null }> {
    const trimmed = fileNo.trim();
    const claimExcludeId = excludeType === 'hasar' ? excludeId : undefined;
    const emergencyExcludeId = excludeType === 'acil' ? excludeId : undefined;

    const existingClaimId = await findClaimFileIdByCompactFileNo(this.prisma, trimmed, claimExcludeId);
    if (existingClaimId) {
      return { exists: true, usedBy: 'hasar', matchedRecord: { id: existingClaimId } };
    }

    const existingEmergencyId = await findEmergencyCaseIdByCompactFileNo(
      this.prisma,
      trimmed,
      emergencyExcludeId,
    );
    if (existingEmergencyId) {
      return { exists: true, usedBy: 'acil', matchedRecord: { id: existingEmergencyId } };
    }

    return { exists: false, usedBy: null, matchedRecord: null };
  }

  // ── Ofis-Saha İş Akışı ────────────────────────────────────────────────────

  private async applyWorkflowStatus(
    fileId: string,
    statusCode: string,
    userId: string,
    options?: { note?: string; responsibleRole?: string },
  ) {
    const file = await this.prisma.claimFile.findUnique({
      where: { id: fileId },
      select: { currentStatusId: true },
    });
    if (!file) return null;

    const seedCodeMap: Record<string, string> = {
      SUPPLIER_ASSIGNED: 'pre_review',
      APPOINTMENT_SCHEDULED: 'site_visit_planned',
      INSPECTION_DONE: 'site_visit_done',
      COST_REPORT_SUBMITTED: 'budget_submitted',
    };
    const lookupCode = seedCodeMap[statusCode] ?? statusCode;
    let status = await this.prisma.claimStatus.findFirst({ where: { code: lookupCode } });
    if (!status) {
      const dynamicId = await this.getOrCreateStatusByCode(statusCode);
      if (!dynamicId) return null;
      status = await this.prisma.claimStatus.findUnique({ where: { id: dynamicId } });
    }
    if (!status || file.currentStatusId === status.id) return status?.id ?? null;

    await this.prisma.$transaction([
      this.prisma.claimFile.update({
        where: { id: fileId },
        data: {
          currentStatusId: status.id,
          lastActivityAt: new Date(),
          lastHumanActionAt: new Date(),
          ...(options?.responsibleRole ? { currentResponsibleRole: options.responsibleRole } : {}),
        },
      }),
      this.prisma.claimStatusHistory.create({
        data: {
          claimFileId: fileId,
          fromStatusId: file.currentStatusId,
          toStatusId: status.id,
          changedByUserId: userId,
          note: options?.note,
        },
      }),
    ]);
    return status.id;
  }

  private async logActivity(params: {
    claimFileId: string;
    action: 'SUPPLIER_ASSIGNED' | 'SUPPLIER_REMOVED' | 'APPOINTMENT_SCHEDULED' | 'APPOINTMENT_UPDATED' | 'INSPECTION_DONE' | 'COST_REPORT_SUBMITTED' | 'ATTACHMENT_ADDED' | 'STATUS_CHANGED' | 'NOTE_ADDED';
    actorId: string;
    actorRole: string;
    description: string;
    metadata?: Record<string, any>;
  }) {
    await this.prisma.fileActivityLog.create({
      data: {
        claimFileId: params.claimFileId,
        action: params.action as any,
        actorId: params.actorId,
        actorRole: params.actorRole,
        description: params.description,
        metadata: params.metadata ?? {},
      },
    });
  }

  private async getOrCreateStatusByCode(code: string): Promise<string | null> {
    const status = await this.prisma.claimStatus.findFirst({ where: { code } });
    if (status) return status.id;
    // Create missing workflow status on the fly
    const newStatus = await this.prisma.claimStatus.create({
      data: {
        code,
        name: STATUS_CODE_LABELS[code] ?? code,
        sequenceNo: 100,
        color: STATUS_CODE_COLORS[code] ?? '#6B7280',
      },
    });
    return newStatus.id;
  }

  async assignInspectorVendor(fileId: string, vendorId: string, actor: any, note?: string) {
    const file = await this.prisma.claimFile.findUnique({ where: { id: fileId } });
    if (!file) throw new NotFoundException('Dosya bulunamadı.');

    const vendor = await this.prisma.vendor.findFirst({
      where: { id: vendorId, status: 'active', canActAsInspector: true },
    });
    if (!vendor) throw new BadRequestException('Seçilen tedarikçi tespitçi olarak görevlendirilmemiş veya aktif değil.');

    await this.prisma.claimFile.update({
      where: { id: fileId },
      data: {
        assignedInspectorVendorId: vendorId,
        inspectorAssignedAt: new Date(),
        assignedFieldUserId: null,
      },
    });

    await this.prisma.repairReport.updateMany({
      where: { claimFileId: fileId, status: 'draft' },
      data: { inspectorName: vendor.name },
    });

    const updated = await this.prisma.claimFile.findUnique({
      where: { id: fileId },
      include: {
        assignedInspectorVendor: {
          select: {
            id: true, name: true, city: true, district: true, type: true,
            phone: true, authorizedPhone: true, canActAsInspector: true,
          },
        },
        currentStatus: true,
      },
    });
    if (!updated) throw new NotFoundException('Dosya bulunamadı.');

    await this.logActivity({
      claimFileId: fileId,
      action: 'NOTE_ADDED',
      actorId: actor.id,
      actorRole: actor.role?.code ?? 'unknown',
      description: `Tespitçi (tedarikçi) "${vendor.name}" atandı.`,
      metadata: { vendorId, vendorName: vendor.name, note },
    });

    return updated;
  }

  private readonly supplierVendorSelect = {
    id: true,
    name: true,
    city: true,
    district: true,
    type: true,
    phone: true,
    authorizedPhone: true,
  } as const;

  private supplierAssignmentsInclude() {
    return {
      orderBy: [{ sortOrder: 'asc' as const }, { assignedAt: 'asc' as const }],
      include: { vendor: { select: this.supplierVendorSelect } },
    };
  }

  /** Birincil alan (assignedSupplierId) = join’deki ilk tedarikçi */
  private async syncPrimarySupplier(fileId: string) {
    const first = await this.prisma.claimFileSupplier.findFirst({
      where: { claimFileId: fileId },
      orderBy: [{ sortOrder: 'asc' }, { assignedAt: 'asc' }],
    });
    await this.prisma.claimFile.update({
      where: { id: fileId },
      data: {
        assignedSupplierId: first?.vendorId ?? null,
        supplierAssignedAt: first?.assignedAt ?? null,
      },
    });
  }

  private async loadClaimWithSuppliers(fileId: string) {
    return this.prisma.claimFile.findUnique({
      where: { id: fileId },
      include: {
        assignedSupplier: { select: this.supplierVendorSelect },
        supplierAssignments: this.supplierAssignmentsInclude(),
        currentStatus: true,
        propertyAddress: true,
      },
    });
  }

  /**
   * Dosyaya bir veya birden fazla tedarikçi ekler (teklif toplama).
   * Geriye uyum: supplierId tekil; supplierIds çoklu. İkisi birleştirilir.
   */
  async assignSupplier(
    fileId: string,
    supplierIdOrIds: string | string[],
    actor: any,
    note?: string,
  ) {
    const supplierIds = (Array.isArray(supplierIdOrIds) ? supplierIdOrIds : [supplierIdOrIds])
      .map((id) => String(id ?? '').trim())
      .filter(Boolean);
    const uniqueIds = [...new Set(supplierIds)];
    if (uniqueIds.length === 0) {
      throw new BadRequestException('En az bir tedarikçi seçiniz.');
    }

    const file = await this.prisma.claimFile.findUnique({
      where: { id: fileId },
      include: {
        assignedSupplier: true,
        propertyAddress: true,
        claimSubject: { select: { name: true } },
        supplierAssignments: { select: { vendorId: true, sortOrder: true } },
      },
    });
    if (!file) throw new NotFoundException('Dosya bulunamadı.');

    const vendors = await this.prisma.vendor.findMany({
      where: { id: { in: uniqueIds } },
      select: { ...this.supplierVendorSelect, status: true },
    });
    if (vendors.length !== uniqueIds.length) {
      throw new NotFoundException('Bir veya daha fazla tedarikçi bulunamadı.');
    }

    const existingIds = new Set(file.supplierAssignments.map((s) => s.vendorId));
    const toAdd = vendors.filter((v) => !existingIds.has(v.id));
    const maxSort = file.supplierAssignments.reduce((m, s) => Math.max(m, s.sortOrder), -1);
    const now = new Date();

    if (toAdd.length > 0) {
      await this.prisma.claimFileSupplier.createMany({
        data: toAdd.map((v, i) => ({
          claimFileId: fileId,
          vendorId: v.id,
          assignedAt: now,
          note: note?.trim() || null,
          sortOrder: maxSort + 1 + i,
        })),
        skipDuplicates: true,
      });
      await this.syncPrimarySupplier(fileId);

      const names = toAdd.map((v) => v.name).join(', ');
      await this.applyWorkflowStatus(fileId, 'SUPPLIER_ASSIGNED', actor.id, {
        note: toAdd.length === 1
          ? `Tedarikçi atandı: ${names}`
          : `Tedarikçiler atandı: ${names}`,
        responsibleRole: 'saha_personeli',
      });

      await this.logActivity({
        claimFileId: fileId,
        action: 'SUPPLIER_ASSIGNED',
        actorId: actor.id,
        actorRole: actor.role?.code ?? 'unknown',
        description: toAdd.length === 1
          ? `Tedarikçi "${names}" atandı.`
          : `${toAdd.length} tedarikçi atandı: ${names}.`,
        metadata: {
          supplierIds: toAdd.map((v) => v.id),
          supplierNames: toAdd.map((v) => v.name),
          note,
        },
      });
    }

    const updated = await this.loadClaimWithSuppliers(fileId);
    if (!updated) throw new NotFoundException('Dosya bulunamadı.');

    let assignmentWhatsApp: { phone: string | null; message: string; url: string } | null = null;
    const assignmentWhatsApps: { vendorId: string; vendorName: string; phone: string | null; message: string; url: string }[] = [];
    if (this.templateService && toAdd.length > 0) {
      try {
        const template = await this.templateService.getByType(TEMPLATE_TYPES.WHATSAPP_VENDOR_ASSIGNMENT);
        if (template.isActive) {
          const addr = file.propertyAddress;
          const hasarAdresi = [
            addr?.addressLine,
            addr?.district,
            addr?.city,
          ].filter(Boolean).join(', ') || 'Adres dosyada tanımlı değil';
          for (const vendor of toAdd) {
            const message = this.templateService.interpolate(template.content, {
              musteriAdi: file.insuredName?.trim() || '—',
              dosyaNo: file.fileNo,
              tedarikciAdi: vendor.name,
              isTanimi: file.claimSubject?.name ?? file.lossType ?? 'Hasar Onarım',
              hasarAdresi,
            });
            const phone = (vendor.authorizedPhone ?? vendor.phone ?? '').replace(/\D/g, '');
            const url = phone
              ? `https://wa.me/90${phone.replace(/^90/, '')}?text=${encodeURIComponent(message)}`
              : `https://wa.me/?text=${encodeURIComponent(message)}`;
            const item = { vendorId: vendor.id, vendorName: vendor.name, phone: phone || null, message, url };
            assignmentWhatsApps.push(item);
            if (!assignmentWhatsApp) assignmentWhatsApp = { phone: item.phone, message: item.message, url: item.url };
          }
        }
      } catch (err: any) {
        this.logger.warn(`[ClaimFiles] Tedarikçi WhatsApp şablonu: ${err?.message}`);
      }
    }

    const assignedSuppliers = updated.supplierAssignments.map((s) => s.vendor);
    return {
      ...updated,
      assignedSuppliers,
      newlyAssignedCount: toAdd.length,
      assignmentWhatsApp,
      assignmentWhatsApps,
    };
  }

  async removeSupplier(fileId: string, vendorId: string, actor: any) {
    const file = await this.prisma.claimFile.findUnique({ where: { id: fileId } });
    if (!file) throw new NotFoundException('Dosya bulunamadı.');

    const link = await this.prisma.claimFileSupplier.findUnique({
      where: { claimFileId_vendorId: { claimFileId: fileId, vendorId } },
      include: { vendor: { select: { id: true, name: true } } },
    });
    if (!link) throw new NotFoundException('Bu tedarikçi dosyaya atanmamış.');

    await this.prisma.claimFileSupplier.delete({ where: { id: link.id } });
    await this.syncPrimarySupplier(fileId);

    await this.logActivity({
      claimFileId: fileId,
      action: 'SUPPLIER_REMOVED',
      actorId: actor.id,
      actorRole: actor.role?.code ?? 'unknown',
      description: `Tedarikçi "${link.vendor.name}" dosyadan kaldırıldı.`,
      metadata: { supplierId: vendorId, supplierName: link.vendor.name },
    });

    const updated = await this.loadClaimWithSuppliers(fileId);
    if (!updated) throw new NotFoundException('Dosya bulunamadı.');
    return {
      ...updated,
      assignedSuppliers: updated.supplierAssignments.map((s) => s.vendor),
    };
  }

  async createFileAppointment(fileId: string, body: { scheduledDate: string; notes?: string }, actor: any) {
    const file = await this.prisma.claimFile.findUnique({ where: { id: fileId } });
    if (!file) throw new NotFoundException('Dosya bulunamadı.');

    const appointment = await this.prisma.fileAppointment.create({
      data: {
        claimFileId: fileId,
        scheduledDate: new Date(body.scheduledDate),
        notes: body.notes,
        status: 'planned',
        createdByUserId: actor.id,
      },
      include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
    });

    const statusId = await this.getOrCreateStatusByCode('APPOINTMENT_SCHEDULED');
    if (statusId) {
      await this.applyWorkflowStatus(fileId, 'APPOINTMENT_SCHEDULED', actor.id, {
        note: body.notes,
        responsibleRole: 'saha_personeli',
      });
    }

    await this.logActivity({
      claimFileId: fileId,
      action: 'APPOINTMENT_SCHEDULED',
      actorId: actor.id,
      actorRole: actor.role?.code ?? 'unknown',
      description: `Randevu planlandı: ${new Date(body.scheduledDate).toLocaleString('tr-TR')}`,
      metadata: { appointmentId: appointment.id, scheduledDate: body.scheduledDate },
    });

    this.cache.invalidatePattern('cache:dashboard:*').catch(() => {});
    return appointment;
  }

  async getFileAppointments(fileId: string) {
    return this.prisma.fileAppointment.findMany({
      where: { claimFileId: fileId },
      include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { scheduledDate: 'asc' },
    });
  }

  async getActivityLog(fileId: string) {
    return this.prisma.fileActivityLog.findMany({
      where: { claimFileId: fileId },
      include: { actor: { select: { id: true, firstName: true, lastName: true, role: { select: { name: true, code: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addInspectionNote(fileId: string, body: { note: string; estimatedCost?: number }, actor: any) {
    const file = await this.prisma.claimFile.findUnique({ where: { id: fileId } });
    if (!file) throw new NotFoundException('Dosya bulunamadı.');

    const note = await this.prisma.note.create({
      data: {
        claimFileId: fileId,
        noteType: 'inspection',
        content: body.note,
        isPrivate: false,
        authorUserId: actor.id,
      },
    });

    const statusId = await this.getOrCreateStatusByCode('INSPECTION_DONE');
    const updateData: any = {};
    if (body.estimatedCost !== undefined) updateData.estimatedCostAmount = body.estimatedCost;
    if (Object.keys(updateData).length) {
      await this.prisma.claimFile.update({ where: { id: fileId }, data: updateData });
    }
    if (statusId) {
      await this.applyWorkflowStatus(fileId, 'INSPECTION_DONE', actor.id, {
        note: body.note,
        responsibleRole: 'operasyon_sorumlusu',
      });
    }

    await this.logActivity({
      claimFileId: fileId,
      action: 'INSPECTION_DONE',
      actorId: actor.id,
      actorRole: actor.role?.code ?? 'unknown',
      description: 'Saha tespiti yapıldı ve not eklendi.',
      metadata: { noteId: note.id, estimatedCost: body.estimatedCost },
    });

    return note;
  }

  async submitCostReport(fileId: string, body: { totalCost: number; description: string; storageKey?: string }, actor: any) {
    const file = await this.prisma.claimFile.findUnique({ where: { id: fileId } });
    if (!file) throw new NotFoundException('Dosya bulunamadı.');

    const statusId = await this.getOrCreateStatusByCode('COST_REPORT_SUBMITTED');
    await this.prisma.claimFile.update({
      where: { id: fileId },
      data: {
        estimatedCostAmount: body.totalCost,
      },
    });
    if (statusId) {
      await this.applyWorkflowStatus(fileId, 'COST_REPORT_SUBMITTED', actor.id, {
        note: body.description,
        responsibleRole: 'operasyon_sorumlusu',
      });
    }

    await this.logActivity({
      claimFileId: fileId,
      action: 'COST_REPORT_SUBMITTED',
      actorId: actor.id,
      actorRole: actor.role?.code ?? 'unknown',
      description: `Maliyet raporu gönderildi: ${body.totalCost.toLocaleString('tr-TR')} TL`,
      metadata: { totalCost: body.totalCost, description: body.description, storageKey: body.storageKey },
    });

    return { fileId, totalCost: body.totalCost, submittedAt: new Date() };
  }

  async getNearbyVendors(fileId: string, purpose: 'supplier' | 'inspector' = 'supplier') {
    const file = await this.prisma.claimFile.findUnique({
      where: { id: fileId },
      include: { propertyAddress: true },
    });
    if (!file) throw new NotFoundException('Dosya bulunamadı.');

    let city = normalizeLocationLabel(file.propertyAddress?.city);
    let districtName = normalizeLocationLabel(file.propertyAddress?.district);
    const addressLine = file.propertyAddress?.addressLine?.trim() || '';

    // city placeholder / boşsa adres satırından il-ilçe parse (v331 backfill kaçırılan dosyalar)
    if ((!city || !districtName) && addressLine) {
      const parsed = await resolveCityDistrictFromAddress(this.prisma, addressLine);
      if (!city && parsed.city) city = parsed.city;
      if (!districtName && parsed.district) districtName = parsed.district;

      // Kalıcı iyileştirme: Belirtilmemiş / boş city'yi parse sonucuna yaz
      if (
        file.propertyAddress
        && parsed.city
        && !normalizeLocationLabel(file.propertyAddress.city)
      ) {
        try {
          await this.prisma.address.update({
            where: { id: file.propertyAddress.id },
            data: {
              city: parsed.city,
              ...(parsed.district && !normalizeLocationLabel(file.propertyAddress.district)
                ? { district: parsed.district }
                : {}),
            },
          });
        } catch (err: any) {
          this.logger.warn(`[ClaimFiles] Adres bölge backfill başarısız: ${err?.message}`);
        }
      }
    }

    const { provinceId, districtId } = await resolveProvinceDistrictIds(
      this.prisma,
      city,
      districtName,
    );

    const where = buildVendorNearbyWhere({
      provinceId,
      districtId,
      city,
      districtName,
      purpose,
    });

    const vendorSelect = {
      id: true, name: true, type: true, phone: true, email: true, authorizedPhone: true,
      city: true, district: true, category: true, canActAsInspector: true,
      serviceAreas: { include: { province: true, district: true } },
    } as const;

    let vendors = await this.prisma.vendor.findMany({
      where,
      select: vendorSelect,
      take: 100,
      orderBy: { name: 'asc' },
    });

    // Bölge eşleşmesi yoksa operasyonu kilitleme — hasar dosyası → hasar havuzu
    if (vendors.length === 0) {
      vendors = await this.prisma.vendor.findMany({
        where:
          purpose === 'inspector'
            ? buildInspectorFallbackWhere()
            : buildSupplierFallbackWhere(['hasar', 'her_ikisi']),
        select: vendorSelect,
        take: 100,
        orderBy: { name: 'asc' },
      });
    }

    if (city && vendors.length > 1) {
      const cityLower = city.toLocaleLowerCase('tr-TR');
      vendors = [...vendors].sort((a, b) => {
        const aCity = (a.city ?? '').toLocaleLowerCase('tr-TR') === cityLower ? 0 : 1;
        const bCity = (b.city ?? '').toLocaleLowerCase('tr-TR') === cityLower ? 0 : 1;
        if (aCity !== bCity) return aCity - bCity;
        return a.name.localeCompare(b.name, 'tr');
      });
    }

    return vendors;
  }
}
