import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException, ForbiddenException, Optional } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EmergencyStatus, Prisma } from '@prisma/client';
import { isFieldStaff } from '@/common/helpers/field-staff.helper';
import { isAssistanceCompanyUser, isInsuranceCompanyUser, mergeWhereAnd, RequestUser } from '@/common/helpers/claim-file-scope.helper';
import { CreateEmergencyCaseDto } from './dto/create-emergency-case.dto';
import { UpdateEmergencyCaseDto } from './dto/update-emergency-case.dto';
import { UpdateEmergencyStatusDto } from './dto/update-emergency-status.dto';
import { CreateCostEntryDto } from './dto/create-cost-entry.dto';
import { UpdateCostEntryDto } from './dto/update-cost-entry.dto';
import { OperationalAccessGrantsService } from '../operational-access-grants/operational-access-grants.service';
import { FileDocumentsService } from '../file-documents/file-documents.service';
import { InvoiceRequestsService } from '../invoice-requests/invoice-requests.service';
import {
  findClaimFileIdByCompactFileNo,
  findEmergencyCaseIdByCompactFileNo,
} from '@/common/utils/file-no-helpers';
import { buildEmergencyOperationChain } from './emergency-operation-chain';
import { VendorIntelligenceProfileService } from '@/modules/vendor-intelligence-profile/vendor-intelligence-profile.service';
import { EmailService } from '@/modules/notifications/email/email.service';
import { ClaimEventEmailService } from '@/modules/notifications/email/claim-event-email.service';
import { StorageService } from '@/modules/storage/storage.service';
import { htmlDocumentToPdf } from '@/common/utils/html-document-to-pdf';
import {
  resolveInsuredPhoneForInbox,
  resolveEmergencyOperationLabel,
  isAcilVendorQualityWarning,
  shouldReportAcilNegativeVendorStrike,
} from '@sigorta/shared';
import { VendorRecommendationService } from '@/modules/vendors/vendor-recommendation.service';
import type { SendMailOptions } from 'nodemailer';
import {
  resolveCustomerReminderEmail,
} from '@/modules/claim-files/approval-72h-customer-email.rule';
import { sanitizeAuditValue } from '@/modules/audit-logs/audit-log.sanitizer';
import {
  EMERGENCY_PROCESS_ACTIONS,
  EMERGENCY_PROCESS_ENTITY_TYPE,
  emergencyProcessDescription,
  isEmergencyProcessAction,
  isEmergencyProcessDuplicate,
  parseEmergencyProcessPayload,
  type EmergencyProcessAction,
} from './emergency-process-events';
import { RecordEmergencyProcessEventDto } from './dto/record-emergency-process-event.dto';
import { SurveysService } from '@/modules/surveys/surveys.service';
import { EmergencyFinanceService } from './emergency-finance.service';
import { buildAcilClosureReportPdf } from './acil-closure-report-pdf';
import {
  buildAcilOperationTimestamps,
  nextAcilOperationStamps,
} from './acil-operation-timestamps';

const MANUAL_DECISION_MIN_REASON = 10;
const PORTAL_ROLE_CODES = new Set([
  'expert',
  'insurance_company_user',
  'assistance_company_user',
  'EXPERT',
  'INSURANCE_COMPANY_USER',
  'ASSISTANCE_COMPANY_USER',
]);
const MERIDYEN_ROLE_CODES = new Set([
  'admin',
  'ADMIN',
  'manager',
  'MANAGER',
  'ops_manager',
  'OPS_MANAGER',
  'office_staff',
  'OFFICE_STAFF',
  'field_staff',
  'FIELD_STAFF',
]);

@Injectable()
export class EmergencyCasesService {
  private readonly logger = new Logger(EmergencyCasesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly operationalAccessGrants: OperationalAccessGrantsService,
    private readonly fileDocumentsService: FileDocumentsService,
    private readonly invoiceRequestsService: InvoiceRequestsService,
    private readonly vendorProfile: VendorIntelligenceProfileService,
    private readonly vendorRecommendation: VendorRecommendationService,
    private readonly emailService: EmailService,
    private readonly claimEventEmail: ClaimEventEmailService,
    private readonly storage: StorageService,
    @Optional() private readonly surveys?: SurveysService,
    @Optional() private readonly emergencyFinance?: EmergencyFinanceService,
  ) {}

  /** Dosya kapanınca ana müşteriye kapanış maili (alış/kâr yok). */
  private async sendClosureEmailOnClose(caseId: string): Promise<{
    sent: boolean;
    to: string | null;
    error: string | null;
  }> {
    try {
      const res = await this.sendClosureEmail(caseId);
      return {
        sent: Boolean(res.data.sent),
        to: res.data.to ?? null,
        error: res.data.errorMsg ?? null,
      };
    } catch (err: any) {
      const error = err?.message ?? 'Kapanış maili gönderilemedi';
      this.logger.warn(`[Kapanış maili] Otomatik gönderim atlandı: ${error}`);
      return { sent: false, to: null, error };
    }
  }

  private async onEmergencyCaseClosed(caseId: string, userId: string): Promise<{
    autoClosureEmail: { sent: boolean; to: string | null; error: string | null };
  }> {
    const autoClosureEmail = await this.sendClosureEmailOnClose(caseId);
    const emergencyCase = await this.prisma.emergencyCase.findUnique({
      where: { id: caseId },
      select: { id: true, caseNo: true, assignedVendorId: true },
    });
    if (!emergencyCase?.assignedVendorId) {
      this.logger.debug(`[Acil hakediş] Atlandı — tedarikçi yok: ${caseId}`);
      return { autoClosureEmail };
    }
    if (this.emergencyFinance) {
      await this.emergencyFinance.grantVendorEntitlement(caseId, userId).catch((err) =>
        this.logger.warn(`[Acil hakediş] Verilemedi: ${err?.message}`),
      );
    }
    await this.ensureFinanceTransfer(caseId, userId).catch((err) =>
      this.logger.warn(`[EPIC-04] Otomatik finans aktarımı atlandı: ${err?.message}`),
    );
    await this.vendorProfile.onFileCompleted({ type: 'emergency_case', id: caseId }).catch((err) =>
      this.logger.warn(`[VendorIntelligenceProfile] Acil kapanış hook: ${err?.message}`),
    );
    return { autoClosureEmail };
  }

  /** EPIC-04: Finansa aktarım entegrasyon noktası (onay sonrası finance modülü bağlanacak). */
  private async onEmergencyCaseInvoiced(caseId: string, userId: string): Promise<void> {
    const emergencyCase = await this.prisma.emergencyCase.findUnique({
      where: { id: caseId },
      select: { caseNo: true },
    });
    this.logger.log(
      `[EPIC-04] Finansa aktarım entegrasyonu bekliyor — case=${emergencyCase?.caseNo ?? caseId}`,
    );
    await this.ensureFinanceTransfer(caseId, userId).catch((err) =>
      this.logger.warn(`[EPIC-04] Fatura talebi senkronu atlandı: ${err?.message}`),
    );
    if (this.emergencyFinance) {
      await this.emergencyFinance.grantVendorEntitlement(caseId, userId).catch((err) =>
        this.logger.warn(`[Acil hakediş] Finans aktarımında: ${err?.message}`),
      );
    }
  }

  private computeOverdueLevel(
    resolvedAt: Date | null,
    invoicedAt: Date | null,
    status: EmergencyStatus,
  ): 'none' | 'warning' | 'critical' {
    if (status === EmergencyStatus.FATURALANDILDI || invoicedAt) return 'none';
    if (!resolvedAt) return 'none';
    const daysSinceResolved = Math.floor(
      (Date.now() - new Date(resolvedAt).getTime()) / (1000 * 60 * 60 * 24),
    );
    if (daysSinceResolved >= 15) return 'critical';
    if (daysSinceResolved >= 7) return 'warning';
    return 'none';
  }

  private enrichCase(c: any) {
    const overdueLevel = this.computeOverdueLevel(c.resolvedAt, c.invoicedAt, c.status);
    const totalGelir = (c.costEntries ?? [])
      .filter((e: any) => e.entryType === 'gelir')
      .reduce((s: number, e: any) => s + e.amount, 0);
    const totalGider = (c.costEntries ?? [])
      .filter((e: any) => e.entryType === 'gider')
      .reduce((s: number, e: any) => s + e.amount, 0);
    return {
      ...c,
      overdueLevel,
      totalGelir,
      totalGider,
      netKar: totalGelir - totalGider,
      operationStatusLabel: resolveEmergencyOperationLabel({
        status: c.status,
        notes: c.notes,
      }),
    };
  }

  /**
   * Sigortalı telefonu: dosyadaki customerPhone; boşsa bağlı ihbar yazışmasından çıkarır ve kaydeder.
   * Yeni şema alanı yok — mevcut customerPhone kullanılır.
   */
  private async ensureCustomerPhoneFromInbound(
    caseId: string,
    existingPhone?: string | null,
    customerPhoneFallback?: string | null,
  ): Promise<string | null> {
    const current = (existingPhone || '').trim();
    if (current) return current;

    const fromCustomer = (customerPhoneFallback || '').trim();
    if (fromCustomer) {
      await this.prisma.emergencyCase.update({
        where: { id: caseId },
        data: { customerPhone: fromCustomer },
      });
      return fromCustomer;
    }

    const inbound = await this.prisma.inboundMessage.findMany({
      where: { emergencyCaseId: caseId },
      orderBy: { receivedAt: 'asc' },
      select: {
        bodyText: true,
        bodyPreview: true,
        bodyHtml: true,
        aiExtractedJson: true,
      },
      take: 30,
    });

    for (const msg of inbound) {
      let extractedPhone: string | null = null;
      const raw = msg.aiExtractedJson;
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        const phone = (raw as Record<string, unknown>).phone;
        if (typeof phone === 'string') extractedPhone = phone;
      }
      const bodyText = [msg.bodyText, msg.bodyPreview, msg.bodyHtml].filter(Boolean).join('\n');
      const resolved = resolveInsuredPhoneForInbox({
        extractedPhone,
        bodyText,
      });
      if (resolved) {
        await this.prisma.emergencyCase.update({
          where: { id: caseId },
          data: { customerPhone: resolved },
        });
        return resolved;
      }
    }
    return null;
  }

  /**
   * Dosya sorumlusu boşsa oluşturan kullanıcıya bağlar (gösterim + erişim tutarlılığı).
   */
  private async ensureAssignedUser(
    caseId: string,
    assignedUserId: string | null | undefined,
    createdByUserId: string,
  ): Promise<string> {
    if (assignedUserId) return assignedUserId;
    await this.prisma.emergencyCase.update({
      where: { id: caseId },
      data: { assignedUserId: createdByUserId },
    });
    return createdByUserId;
  }

  private async ensureFinanceTransfer(caseId: string, userId: string): Promise<void> {
    const emergencyCase = await this.prisma.emergencyCase.findUnique({
      where: { id: caseId },
      include: {
        costEntries: true,
        invoiceRequests: {
          where: { status: { in: ['pending', 'approved', 'invoiced'] } },
          select: { id: true },
          take: 1,
        },
      },
    });
    if (!emergencyCase) return;
    if (!(emergencyCase.status === EmergencyStatus.COZULDU || emergencyCase.status === EmergencyStatus.FATURALANDILDI)) {
      return;
    }
    if (emergencyCase.invoiceRequests.length > 0) return;

    const closure = await this.fileDocumentsService.checkEmergencyCaseClosureConditions(caseId);
    if (!closure.canCreateInvoiceRequest) return;

    const gelirEntries = emergencyCase.costEntries.filter((entry) => entry.entryType === 'gelir');
    const totalAmount = gelirEntries.reduce((sum, entry) => sum + entry.amount, 0);
    if (totalAmount <= 0) return;

    await this.invoiceRequestsService.create(
      {
        serviceType: 'emergency',
        emergencyCaseId: caseId,
        insuranceCompanyId: emergencyCase.customerId ?? undefined,
        insuranceCompanyName: emergencyCase.customerName,
        fileNo: emergencyCase.fileNo ?? emergencyCase.caseNo,
        totalAmount,
        workItemsSummary: gelirEntries.map((entry) => ({
          description: entry.description,
          amount: entry.amount,
        })),
        notes: 'Acil yardım operasyon zinciri kapanış hooku ile otomatik oluşturuldu.',
      },
      userId,
    );
  }

  private async buildOperationChain(caseId: string) {
    const [emergencyCase, inboundMessages, documents, invoiceRequests, closure, entitlement] = await Promise.all([
      this.prisma.emergencyCase.findUnique({
        where: { id: caseId },
        include: {
          assignedVendor: { select: { name: true } },
          costEntries: true,
          invoiceItems: {
            include: { draft: { select: { status: true } } },
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
      this.prisma.inboundMessage.findMany({
        where: { emergencyCaseId: caseId },
        select: {
          receivedAt: true,
          attachments: { select: { id: true } },
        },
        orderBy: { receivedAt: 'desc' },
      }),
      this.prisma.fileDocument.findMany({
        where: { entityType: 'emergency_case', entityId: caseId },
        select: {
          documentKind: true,
          whatsappSentAt: true,
          digitallyApprovedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.invoiceRequest.findMany({
        where: { emergencyCaseId: caseId },
        select: { status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.fileDocumentsService.checkEmergencyCaseClosureConditions(caseId),
      this.prisma.emergencyVendorEntitlement.findUnique({
        where: { caseId },
        select: { grantedAt: true },
      }).catch(() => null),
    ]);

    if (!emergencyCase) {
      throw new NotFoundException('Acil vaka bulunamadı');
    }

    const totalGelir = emergencyCase.costEntries
      .filter((entry) => entry.entryType === 'gelir')
      .reduce((sum, entry) => sum + entry.amount, 0);
    const totalGider = emergencyCase.costEntries
      .filter((entry) => entry.entryType === 'gider')
      .reduce((sum, entry) => sum + entry.amount, 0);
    const vendorGider = emergencyCase.costEntries
      .filter((entry) => entry.entryType === 'gider' && !!entry.vendorId)
      .reduce((sum, entry) => sum + entry.amount, 0);

    return buildEmergencyOperationChain({
      status: emergencyCase.status,
      assignedVendorName: emergencyCase.assignedVendor?.name,
      totalGelir,
      totalGider,
      vendorGider,
      inboxMessageCount: inboundMessages.length,
      inboxAttachmentCount: inboundMessages.reduce((sum, item) => sum + item.attachments.length, 0),
      lastInboxAt: inboundMessages[0]?.receivedAt?.toISOString() ?? null,
      documentCount: documents.length,
      whatsappSentCount: documents.filter((doc) => !!doc.whatsappSentAt).length,
      digitallyApprovedCount: documents.filter((doc) => !!doc.digitallyApprovedAt).length,
      hasApprovedMatbuEvrak: documents.some(
        (doc) => doc.documentKind === 'matbu_evrak' && !!doc.digitallyApprovedAt,
      ),
      invoiceRequestCount: invoiceRequests.length,
      latestInvoiceRequestStatus: invoiceRequests[0]?.status ?? null,
      invoiceDraftCount: emergencyCase.invoiceItems.length,
      latestInvoiceDraftStatus: emergencyCase.invoiceItems[0]?.draft?.status ?? null,
      canCreateInvoiceRequest: closure.canCreateInvoiceRequest,
      createdAt: emergencyCase.createdAt,
      fileDate: emergencyCase.fileDate,
      vendorEntitlementGrantedAt: entitlement?.grantedAt ?? null,
    });
  }

  async generateCaseNo(): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `AY-${year}${month}-`;
    const latest = await this.prisma.emergencyCase.findFirst({
      where: { caseNo: { startsWith: prefix } },
      orderBy: { caseNo: 'desc' },
    });
    const seq = latest
      ? parseInt(latest.caseNo.replace(prefix, ''), 10) + 1
      : 1;
    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  async checkFileNo(
    fileNo: string,
    excludeId?: string,
  ): Promise<{ exists: boolean; usedBy: 'hasar' | 'acil' | null }> {
    const trimmed = fileNo.trim();
    const emergencyId = await findEmergencyCaseIdByCompactFileNo(this.prisma, trimmed, excludeId);
    if (emergencyId) {
      return { exists: true, usedBy: 'acil' };
    }

    const claimId = await findClaimFileIdByCompactFileNo(this.prisma, trimmed);
    if (claimId) {
      return { exists: true, usedBy: 'hasar' };
    }

    return { exists: false, usedBy: null };
  }

  async create(dto: CreateEmergencyCaseDto, userId: string) {
    const fileNo = dto.fileNo?.trim();
    if (!fileNo) {
      throw new BadRequestException('Dosya numarası zorunludur');
    }

    const { exists } = await this.checkFileNo(fileNo);
    if (exists) {
      throw new ConflictException('Bu dosya numarası zaten kullanılıyor');
    }

    const caseNo = await this.generateCaseNo();
    const fileDate = new Date(dto.fileDate);
    if (Number.isNaN(fileDate.getTime())) {
      throw new BadRequestException('Dosya tarihi geçerli olmalıdır');
    }

    const created = await this.prisma.emergencyCase.create({
      data: {
        caseNo,
        fileNo,
        customerName: dto.customerName,
        customerPhone: dto.customerPhone,
        customerId: dto.customerId,
        address: dto.address,
        city: dto.city,
        district: dto.district,
        issueType: dto.issueType,
        urgency: dto.urgency ?? 'NORMAL',
        fileDate,
        assignedVendorId: dto.assignedVendorId,
        assignedUserId: dto.assignedUserId ?? userId,
        notes: dto.notes,
        findingsText: dto.findingsText.trim(),
        createdByUserId: userId,
      },
      include: { assignedVendor: true, assignedUser: true, costEntries: true },
    });
    const delegationStamp = await this.operationalAccessGrants.getFunctionDelegationStamp(
      userId,
      'acil_yardim',
    );
    if (delegationStamp) {
      await this.prisma.auditLog.create({
        data: {
          entityType: 'EmergencyCase',
          entityId: created.id,
          action: 'CREATE',
          userId,
          newValue: delegationStamp as Prisma.InputJsonValue,
        },
      });
    }
    if (dto.assignedVendorId) {
      void this.reportNegativeVendorIfNeeded(created.id, dto.assignedVendorId).catch((err) =>
        this.logger.warn(`[Acil tedarikçi] Olumsuz atama raporu atlandı: ${err?.message}`),
      );
    }
    return { data: this.enrichCase(created) };
  }

  async findAllForCustomer(
    customerId: string,
    filters: {
      status?: EmergencyStatus;
      month?: number;
      year?: number;
      search?: string;
      overdueOnly?: boolean;
    },
    requestingUser?: RequestUser,
    insuranceCompanyIds?: string[],
  ) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true },
    });
    if (!customer) {
      throw new NotFoundException('Müşteri bulunamadı');
    }

    return this.findAll(
      { ...filters, customerId },
      requestingUser,
      insuranceCompanyIds,
    );
  }

  private async buildListScope(
    filters: { customerId?: string },
    requestingUser?: RequestUser,
    insuranceCompanyIds?: string[],
    assistantCustomerIds?: string[],
  ): Promise<Record<string, unknown>> {
    const where: Record<string, unknown> = {};
    if (filters.customerId) where.customerId = filters.customerId;

    if (requestingUser && isFieldStaff(requestingUser.roleCode)) {
      where.OR = [
        { assignedUserId: requestingUser.id },
        {
          customer: {
            claimFiles: { some: { assignedFieldUserId: requestingUser.id } },
          },
        },
      ];
    }

    if (
      requestingUser
      && this.operationalAccessGrants.isDelegationScopedRole(requestingUser.roleCode)
    ) {
      const delegationWhere = await this.operationalAccessGrants.buildEmergencyDelegationScope(
        requestingUser.id,
        requestingUser.roleCode,
      );
      Object.assign(where, delegationWhere);
    }

    if (requestingUser && isInsuranceCompanyUser(requestingUser.roleCode) && insuranceCompanyIds?.length) {
      where.customer = {
        claimFiles: { some: { insuranceCompanyId: { in: insuranceCompanyIds } } },
      };
    }

    if (requestingUser && isAssistanceCompanyUser(requestingUser.roleCode) && assistantCustomerIds?.length) {
      where.customerId = { in: assistantCustomerIds };
    }

    return where;
  }

  private async assertCaseAccess(
    emergencyCase: {
      id: string;
      assignedUserId?: string | null;
      customerId?: string | null;
      createdByUserId?: string | null;
    },
    requestingUser?: RequestUser,
    insuranceCompanyIds?: string[],
    assistantCustomerIds?: string[],
  ): Promise<void> {
    if (!requestingUser) return;

    if (isFieldStaff(requestingUser.roleCode)) {
      if (emergencyCase.assignedUserId === requestingUser.id) return;
      if (emergencyCase.customerId) {
        const linked = await this.prisma.claimFile.findFirst({
          where: {
            customerId: emergencyCase.customerId,
            assignedFieldUserId: requestingUser.id,
          },
          select: { id: true },
        });
        if (linked) return;
      }
      throw new ForbiddenException('Bu dosyaya erişim izniniz bulunmamaktadır');
    }

    if (isInsuranceCompanyUser(requestingUser.roleCode) && insuranceCompanyIds?.length) {
      if (!emergencyCase.customerId) {
        throw new ForbiddenException('Bu dosyaya erişim izniniz bulunmamaktadır');
      }
      const linked = await this.prisma.claimFile.findFirst({
        where: {
          customerId: emergencyCase.customerId,
          insuranceCompanyId: { in: insuranceCompanyIds },
        },
        select: { id: true },
      });
      if (!linked) {
        throw new ForbiddenException('Bu dosyaya erişim izniniz bulunmamaktadır');
      }
      return;
    }

    if (isAssistanceCompanyUser(requestingUser.roleCode)) {
      if (
        !assistantCustomerIds?.length
        || !emergencyCase.customerId
        || !assistantCustomerIds.includes(emergencyCase.customerId)
      ) {
        throw new ForbiddenException('Bu dosyaya erişim izniniz bulunmamaktadır');
      }
      return;
    }

    if (this.operationalAccessGrants.isDelegationScopedRole(requestingUser.roleCode)) {
      if (await this.operationalAccessGrants.hasFunctionDelegation(requestingUser.id, 'acil_yardim')) {
        return;
      }
      const assignedId = emergencyCase.assignedUserId;
      if (assignedId === requestingUser.id) return;
      if (!assignedId && emergencyCase.createdByUserId === requestingUser.id) return;
      if (!assignedId) {
        throw new ForbiddenException('Bu dosyaya erişim izniniz bulunmamaktadır');
      }
      const viaDelegation = await this.operationalAccessGrants.canAccessAssignedUserViaDelegation(
        requestingUser.id,
        assignedId,
        'acil_yardim',
      );
      if (!viaDelegation) {
        throw new ForbiddenException('Bu dosyaya erişim izniniz bulunmamaktadır');
      }
    }
  }

  async findAll(
    filters: {
      status?: EmergencyStatus;
      month?: number;
      year?: number;
      customerId?: string;
      search?: string;
      overdueOnly?: boolean;
    },
    requestingUser?: RequestUser,
    insuranceCompanyIds?: string[],
    assistantCustomerIds?: string[],
  ) {
    const where: any = await this.buildListScope(
      { customerId: filters.customerId },
      requestingUser,
      insuranceCompanyIds,
      assistantCustomerIds,
    );
    if (filters.status) where.status = filters.status;
    if (filters.search) {
      const q = filters.search.trim();
      const digits = q.replace(/[\s\-./]/g, '');
      const or: Array<Record<string, unknown>> = [
        { customerName: { contains: q, mode: 'insensitive' } },
        { address: { contains: q, mode: 'insensitive' } },
        { caseNo: { contains: q, mode: 'insensitive' } },
        { fileNo: { contains: q, mode: 'insensitive' } },
      ];
      if (digits && digits !== q) {
        or.push({ fileNo: { contains: digits, mode: 'insensitive' } });
        or.push({ caseNo: { contains: digits, mode: 'insensitive' } });
      }
      const scoped = mergeWhereAnd(where, { OR: or });
      Object.keys(where).forEach((k) => delete where[k]);
      Object.assign(where, scoped);
    }
    if (filters.year && filters.month) {
      const start = new Date(filters.year, filters.month - 1, 1);
      const end = new Date(filters.year, filters.month, 1);
      where.fileDate = { gte: start, lt: end };
    }

    const cases = await this.prisma.emergencyCase.findMany({
      where,
      // Liste: konum/saat kolonları lokal DB’de yoksa tüm satır düşmesin
      select: {
        id: true,
        caseNo: true,
        fileNo: true,
        customerId: true,
        customerName: true,
        customerPhone: true,
        address: true,
        city: true,
        district: true,
        issueType: true,
        urgency: true,
        status: true,
        assignedVendorId: true,
        assignedUserId: true,
        notes: true,
        findingsText: true,
        fileDate: true,
        invoicedAt: true,
        resolvedAt: true,
        createdByUserId: true,
        createdAt: true,
        updatedAt: true,
        assignedVendor: { select: { id: true, name: true, phone: true, notes: true } },
        assignedUser: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
        customer: {
          select: {
            id: true,
            shortName: true,
            fullName: true,
            companyName: true,
            firstName: true,
            lastName: true,
            entityType: true,
            subType: true,
          },
        },
        costEntries: true,
      },
      orderBy: [{ urgency: 'desc' }, { fileDate: 'desc' }, { createdAt: 'desc' }],
    });

    const enriched = cases.map((c) => this.enrichCase(c));
    const filtered = filters.overdueOnly
      ? enriched.filter((c) => c.overdueLevel !== 'none')
      : enriched;

    return { data: filtered };
  }

  async findOne(
    id: string,
    requestingUser?: RequestUser,
    insuranceCompanyIds?: string[],
    assistantCustomerIds?: string[],
  ) {
    const c = await this.prisma.emergencyCase.findUnique({
      where: { id },
      include: {
        assignedVendor: { select: { id: true, name: true, phone: true, notes: true } },
        assignedUser: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
        customer: {
          select: {
            id: true,
            shortName: true,
            fullName: true,
            companyName: true,
            firstName: true,
            lastName: true,
            entityType: true,
            subType: true,
            email: true,
            phone: true,
          },
        },
        costEntries: { orderBy: { entryDate: 'asc' } },
        invoiceItems: { include: { draft: true } },
      },
    });
    if (!c) throw new NotFoundException('Acil vaka bulunamadı');
    await this.assertCaseAccess(c, requestingUser, insuranceCompanyIds, assistantCustomerIds);

    const resolvedAssigneeId = await this.ensureAssignedUser(
      id,
      c.assignedUserId,
      c.createdByUserId,
    );
    let assignedUser = c.assignedUser;
    if (!assignedUser && resolvedAssigneeId) {
      assignedUser = await this.prisma.user.findUnique({
        where: { id: resolvedAssigneeId },
        select: { id: true, firstName: true, lastName: true, phone: true, email: true },
      });
    }
    if (!assignedUser && c.createdBy) {
      assignedUser = c.createdBy;
    }

    const activeDelegation = requestingUser
      ? await this.operationalAccessGrants.resolveDelegationBanner(
          requestingUser.id,
          resolvedAssigneeId,
          'acil_yardim',
        )
      : null;

    const operationChain = await this.buildOperationChain(id);
    const customerPhone =
      (await this.ensureCustomerPhoneFromInbound(
        id,
        c.customerPhone,
        c.customer?.phone,
      )) ?? c.customerPhone;
    const { createdBy: _createdBy, ...caseWithoutCreatedBy } = c;
    const operationTimestamps = buildAcilOperationTimestamps({
      notifiedAt: operationChain.inbox.lastReceivedAt ?? c.fileDate,
      workStartedAt: c.workStartedAt,
      serviceDeliveredAt: c.serviceDeliveredAt,
      closedAt: c.resolvedAt,
    });
    return {
      data: {
        ...this.enrichCase({
          ...caseWithoutCreatedBy,
          assignedUserId: resolvedAssigneeId,
          assignedUser,
          customerPhone,
        }),
        activeDelegation,
        operationChain,
        operationTimestamps,
      },
    };
  }

  async update(id: string, dto: UpdateEmergencyCaseDto) {
    const existing = await this.findOne(id);

    // fileNo benzersizlik kontrolü (dolu ise, kendi ID'si hariç)
    if (dto.fileNo !== undefined && dto.fileNo?.trim()) {
      const { exists } = await this.checkFileNo(dto.fileNo.trim(), id);
      if (exists) {
        throw new ConflictException('Bu dosya numarası zaten kullanılıyor');
      }
    }

    const updated = await this.prisma.emergencyCase.update({
      where: { id },
      data: {
        ...(dto.customerName && { customerName: dto.customerName }),
        ...(dto.customerPhone !== undefined && { customerPhone: dto.customerPhone }),
        ...(dto.customerId !== undefined && { customerId: dto.customerId }),
        ...(dto.fileNo !== undefined && { fileNo: dto.fileNo }),
        ...(dto.address && { address: dto.address }),
        ...(dto.city !== undefined && { city: dto.city }),
        ...(dto.district !== undefined && { district: dto.district }),
        ...(dto.issueType && { issueType: dto.issueType }),
        ...(dto.urgency && { urgency: dto.urgency }),
        ...(dto.assignedVendorId !== undefined && { assignedVendorId: dto.assignedVendorId }),
        ...(dto.assignedUserId !== undefined && { assignedUserId: dto.assignedUserId }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.findingsText !== undefined && { findingsText: dto.findingsText }),
        ...(dto.vendorPaid !== undefined && { vendorPaid: dto.vendorPaid }),
        ...(dto.latitude !== undefined && { latitude: dto.latitude }),
        ...(dto.longitude !== undefined && { longitude: dto.longitude }),
      },
      include: { assignedVendor: true, assignedUser: true, costEntries: true },
    });
    const nextVendorId = dto.assignedVendorId;
    const prevVendorId = existing.data?.assignedVendorId ?? null;
    if (nextVendorId && nextVendorId !== prevVendorId) {
      void this.reportNegativeVendorIfNeeded(id, nextVendorId).catch((err) =>
        this.logger.warn(`[Acil tedarikçi] Olumsuz atama raporu atlandı: ${err?.message}`),
      );
    }
    return { data: this.enrichCase(updated) };
  }

  /**
   * Olumsuz memnuniyet/maliyet ile 2. Acil çalışma → yöneticiye e-posta.
   * Atamayı bloklamaz; SMTP yoksa yalnızca log.
   */
  private async reportNegativeVendorIfNeeded(caseId: string, vendorId: string): Promise<void> {
    const [priorOtherAssignments, metrics, recs, vendor, emergencyCase, admins] = await Promise.all([
      this.prisma.emergencyCase.count({
        where: { assignedVendorId: vendorId, NOT: { id: caseId } },
      }),
      this.vendorRecommendation.getOperationMetrics(vendorId, 'acil'),
      this.vendorRecommendation.recommendForEmergencyCase(caseId, 40).catch(() => []),
      this.prisma.vendor.findUnique({ where: { id: vendorId }, select: { name: true } }),
      this.prisma.emergencyCase.findUnique({
        where: { id: caseId },
        select: { caseNo: true, fileNo: true, customerName: true, city: true, district: true },
      }),
      this.prisma.user.findMany({
        where: {
          status: 'active',
          role: { code: { in: ['admin', 'ADMIN'] } },
        },
        select: { email: true },
        take: 20,
      }),
    ]);

    const rec = recs.find((item) => item.id === vendorId);
    const qualityWarning = rec?.qualityWarning
      ?? isAcilVendorQualityWarning({
        avgServiceScore: metrics.avgServiceScore,
        compositeScore: rec?.compositeScore ?? null,
        completedFileCount: metrics.completedFileCount,
      });
    if (!qualityWarning) return;
    if (!shouldReportAcilNegativeVendorStrike(priorOtherAssignments)) return;

    const emails = [...new Set(admins.map((u) => u.email).filter((e): e is string => Boolean(e?.trim())))];
    if (emails.length === 0) {
      this.logger.warn('[Acil tedarikçi] Olumsuz 2. atama — yönetici e-postası yok');
      return;
    }

    const fileNo = emergencyCase?.fileNo || emergencyCase?.caseNo || caseId;
    const vendorName = vendor?.name ?? vendorId;
    const location = [emergencyCase?.district, emergencyCase?.city].filter(Boolean).join(' / ') || '—';
    const subject = `Acil Yardım — Olumsuz Tedarikçi 2. Çalışma (${fileNo})`;
    const html = `
      <p>Dosya sorumlusu, memnuniyet veya maliyet değerlendirmesi olumsuz olan bir tedarikçiyle ikinci kez çalıştı.</p>
      <p><strong>Dosya:</strong> ${fileNo}<br/>
      <strong>Müşteri:</strong> ${emergencyCase?.customerName ?? '—'}<br/>
      <strong>Bölge:</strong> ${location}<br/>
      <strong>Tedarikçi:</strong> ${vendorName}<br/>
      <strong>Önceki Acil atama sayısı:</strong> ${priorOtherAssignments}</p>
    `;
    const text = `Dosya ${fileNo} — olumsuz tedarikçi ${vendorName} ile 2. çalışma.`;
    await Promise.all(
      emails.map((to) => this.emailService.sendEmail(to, subject, html, { text, mailbox: 'IHBAR' })),
    );
  }

  async updateStatus(id: string, dto: UpdateEmergencyStatusDto, userId = 'system') {
    const current = await this.prisma.emergencyCase.findUnique({
      where: { id },
      select: { workStartedAt: true, serviceDeliveredAt: true },
    });
    await this.findOne(id);
    const now = new Date();
    const data: any = { status: dto.status };
    if (dto.status === EmergencyStatus.SAHADA && !current?.workStartedAt) {
      data.workStartedAt = now;
    }
    if (dto.status === EmergencyStatus.COZULDU) {
      data.resolvedAt = now;
      if (!current?.serviceDeliveredAt) data.serviceDeliveredAt = now;
      if (!current?.workStartedAt) data.workStartedAt = now;
    }
    if (dto.status === EmergencyStatus.FATURALANDILDI) data.invoicedAt = now;
    const updated = await this.prisma.emergencyCase.update({
      where: { id },
      data,
      include: { assignedVendor: true, assignedUser: true, costEntries: true },
    });
    let autoClosureEmail: { sent: boolean; to: string | null; error: string | null } | undefined;
    if (dto.status === EmergencyStatus.COZULDU) {
      const closed = await this.onEmergencyCaseClosed(id, userId).catch((err) => {
        this.logger.warn(`[EPIC-04] Kapanış hook hatası: ${err?.message}`);
        return null;
      });
      autoClosureEmail = closed?.autoClosureEmail;
      void this.surveys?.ensureCampaignForEmergencyCase(id).catch((err: unknown) =>
        this.logger.warn(`[Survey] Acil kapanış kampanyası: ${(err as Error)?.message}`),
      );
    }
    if (dto.status === EmergencyStatus.FATURALANDILDI) {
      await this.onEmergencyCaseInvoiced(id, userId).catch((err) =>
        this.logger.warn(`[EPIC-04] Finans aktarım hook hatası: ${err?.message}`),
      );
    }
    return { data: { ...this.enrichCase(updated), autoClosureEmail } };
  }

  async remove(id: string) {
    await this.findOne(id);
    throw new BadRequestException(
      'Acil yardım dosyası kalıcı olarak silinemez. Dosyayı durum akışı ile sonuçlandırın.',
    );
  }

  // ─── Maliyet Girişleri ────────────────────────────────────────────────────

  async addCostEntry(caseId: string, dto: CreateCostEntryDto, userId: string) {
    await this.findOne(caseId);
    if (!['gelir', 'gider'].includes(dto.entryType)) {
      throw new BadRequestException('entryType "gelir" veya "gider" olmalı');
    }
    const entry = await this.prisma.emergencyCostEntry.create({
      data: {
        caseId,
        entryType: dto.entryType,
        description: dto.description,
        amount: dto.amount,
        entryDate: new Date(dto.entryDate),
        receiptKey: dto.receiptKey,
        vendorId: dto.vendorId ?? null,
        createdByUserId: userId,
      },
      include: { vendor: { select: { id: true, name: true } } },
    });
    return { data: entry };
  }

  async findCostEntries(caseId: string) {
    const entries = await this.prisma.emergencyCostEntry.findMany({
      where: { caseId },
      orderBy: { entryDate: 'asc' },
      include: { vendor: { select: { id: true, name: true } } },
    });
    const totalGelir = entries.filter((e) => e.entryType === 'gelir').reduce((s, e) => s + e.amount, 0);
    const totalGider = entries.filter((e) => e.entryType === 'gider').reduce((s, e) => s + e.amount, 0);
    return { data: entries, summary: { totalGelir, totalGider, netKar: totalGelir - totalGider } };
  }

  async removeCostEntry(caseId: string, costId: string) {
    const entry = await this.prisma.emergencyCostEntry.findFirst({ where: { id: costId, caseId } });
    if (!entry) throw new NotFoundException('Maliyet kaydı bulunamadı');
    throw new BadRequestException(
      'Maliyet kaydı kalıcı olarak silinemez. Yanlış kayıt için düzeltme veya ters kayıt yöntemi kullanılmalıdır.',
    );
  }

  async updateCostEntry(caseId: string, costId: string, dto: UpdateCostEntryDto) {
    const entry = await this.prisma.emergencyCostEntry.findFirst({ where: { id: costId, caseId } });
    if (!entry) throw new NotFoundException('Maliyet kaydı bulunamadı');
    const updated = await this.prisma.emergencyCostEntry.update({
      where: { id: costId },
      data: {
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.amount !== undefined && { amount: dto.amount }),
        ...(dto.entryDate !== undefined && { entryDate: new Date(dto.entryDate) }),
        ...(dto.receiptKey !== undefined && { receiptKey: dto.receiptKey }),
        ...(dto.vendorId !== undefined && { vendorId: dto.vendorId }),
      },
      include: { vendor: { select: { id: true, name: true } } },
    });
    return { data: updated };
  }

  /**
   * Asistans firmasına kapanış e-postası önizleme / gönderim.
   * Alış fiyatı, kâr ve iç operasyon notları dahil edilmez.
   */
  private async buildClosureEmailPayload(caseId: string) {
    const emergencyCase = await this.prisma.emergencyCase.findUnique({
      where: { id: caseId },
      include: {
        customer: {
          select: {
            id: true,
            email: true,
            shortName: true,
            companyName: true,
            fullName: true,
            firstName: true,
            lastName: true,
          },
        },
        costEntries: {
          where: { entryType: 'gelir' },
          orderBy: { entryDate: 'desc' },
          take: 5,
        },
      },
    });
    if (!emergencyCase) throw new NotFoundException('Dosya bulunamadı');

    const inbound = await this.prisma.inboundMessage.findMany({
      where: { emergencyCaseId: caseId },
      orderBy: { receivedAt: 'asc' },
      select: {
        fromAddress: true,
        fromName: true,
        toAddresses: true,
        receivedAt: true,
      },
      take: 50,
    });

    const emailSet = new Set<string>();
    const addEmail = (raw?: string | null) => {
      const e = (raw || '').trim().toLowerCase();
      if (!e || !e.includes('@')) return;
      // Meridyen iç kutuları alıcıya ekleme
      if (/@(meridyen|localhost)/i.test(e)) return;
      emailSet.add(e);
    };

    for (const msg of inbound) {
      addEmail(msg.fromAddress);
      for (const t of msg.toAddresses || []) addEmail(t);
    }
    addEmail(emergencyCase.customer?.email);

    const recipients = [...emailSet];
    const latestInbound = [...inbound].reverse().find((m) => (m.fromAddress || '').includes('@'));
    const greetingName = this.resolveClosureGreetingName(latestInbound?.fromName, latestInbound?.fromAddress);
    const greeting = greetingName ? `Sayın ${greetingName},` : 'Sayın Yetkili,';

    const to = recipients.join(', ');
    const fileNo = emergencyCase.fileNo || emergencyCase.caseNo;
    const insured =
      (emergencyCase.customerName || '').trim()
      || [emergencyCase.customer?.firstName, emergencyCase.customer?.lastName].filter(Boolean).join(' ').trim()
      || emergencyCase.customer?.fullName
      || '—';
    const insuredPhone =
      (await this.ensureCustomerPhoneFromInbound(caseId, emergencyCase.customerPhone)) || '—';
    const saleAmount = emergencyCase.costEntries.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const saleLabel =
      saleAmount > 0
        ? `${saleAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`
        : '—';
    const closedAt = (emergencyCase.resolvedAt || new Date()).toLocaleString('tr-TR');
    const inboundAt = inbound[0]?.receivedAt
      ? inbound[0].receivedAt.toLocaleString('tr-TR')
      : emergencyCase.fileDate
        ? emergencyCase.fileDate.toLocaleString('tr-TR')
        : '—';
    const workStartedAt = emergencyCase.workStartedAt
      ? emergencyCase.workStartedAt.toLocaleString('tr-TR')
      : '—';
    const serviceDeliveredAt = emergencyCase.serviceDeliveredAt
      ? emergencyCase.serviceDeliveredAt.toLocaleString('tr-TR')
      : '—';
    const summary = (emergencyCase.notes || '').trim().slice(0, 160) || 'Hizmet tamamlandı';
    const subject = `Dosya Kapanışı – ${fileNo}`;
    const bodyText = [
      greeting,
      '',
      'Dosya kapanış bilgileri aşağıdadır.',
      '',
      `Dosya No: ${fileNo}`,
      `Sigortalı: ${insured}`,
      `Sigortalı Telefon: ${insuredPhone}`,
      `Dosya Konusu: ${emergencyCase.issueType}`,
      `İhbar Tarihi: ${inboundAt}`,
      `İşe Başlama: ${workStartedAt}`,
      `Hizmet Verilme: ${serviceDeliveredAt}`,
      `Operasyon / Tamamlanma: ${summary}`,
      `Onaylı Hizmet Bedeli: ${saleLabel}`,
      `Kapanış Tarihi: ${closedAt}`,
      '',
      'Ekler: kapanış raporu PDF, onaylı fotoğraflar ve belgeler (varsa).',
      '',
      'Saygılarımızla,',
      'Meridyen Assistance',
    ].join('\n');

    // Güvenlik: alış / kâr / iç operasyon ifadeleri sızmasın
    const forbidden = /(alış|ali[sş]\s*fiyat|kâr\s*\(?%|kar\s*\(?%|i[cç]\s*operasyon|hakedi[sş])/i;
    if (forbidden.test(bodyText)) {
      throw new BadRequestException('Kapanış e-postası güvenlik kontrolünden geçemedi');
    }

    const docs = await this.prisma.fileDocument.findMany({
      where: { entityType: 'emergency_case', entityId: caseId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const attachments: NonNullable<SendMailOptions['attachments']> = [];
    const attachmentNames: string[] = [];
    const reportFile = `kapanis-raporu-${String(fileNo).replace(/[^\w.-]+/g, '_')}.pdf`;
    attachments.push({
      filename: reportFile,
      content: buildAcilClosureReportPdf({
        fileNo,
        insured,
        subject: String(emergencyCase.issueType || ''),
        ihbarAt: inboundAt,
        workStartedAt,
        serviceDeliveredAt,
        closedAt,
        summary,
      }),
      contentType: 'application/pdf',
    });
    attachmentNames.push(reportFile);

    for (const doc of docs) {
      const kindLabel = doc.documentKind === 'matbu_evrak' ? 'Matbu-Evrak' : 'Belge';
      if (doc.physicalUploadKey) {
        try {
          const content = await this.storage.download(doc.physicalUploadKey);
          const filename = `${kindLabel}-${fileNo}-${doc.id.slice(0, 8)}.bin`;
          const ext = doc.physicalUploadKey.split('.').pop();
          attachments.push({
            filename: ext && ext.length <= 5 ? `${kindLabel}-${fileNo}.${ext}` : filename,
            content,
          });
          attachmentNames.push(attachments[attachments.length - 1].filename as string);
        } catch (err: any) {
          this.logger.warn(`Kapanış eki indirilemedi (${doc.id}): ${err?.message}`);
        }
      } else if (doc.renderedContent) {
        const isMatbu = doc.documentKind === 'matbu_evrak';
        const pdfName = `${isMatbu ? 'Servis-Onay-Formu' : 'Belge'}-${fileNo}.pdf`;
        if (isMatbu) {
          try {
            const pdf = await htmlDocumentToPdf(doc.renderedContent);
            if (pdf) {
              attachments.push({
                filename: pdfName,
                content: pdf,
                contentType: 'application/pdf',
              });
              attachmentNames.push(pdfName);
              continue;
            }
          } catch (err: any) {
            this.logger.warn(`Servis onay PDF üretilemedi (${doc.id}): ${err?.message}`);
          }
        }
        const filename = `${isMatbu ? 'Servis-Onay-Formu' : 'Belge'}-${fileNo}.html`;
        attachments.push({
          filename,
          content: Buffer.from(doc.renderedContent, 'utf8'),
          contentType: 'text/html; charset=utf-8',
        });
        attachmentNames.push(filename);
      }
    }

    // Maliyet fişleri (hizmet bedeli makbuzu vb.) — alış satırı eklenmez
    const receiptEntries = await this.prisma.emergencyCostEntry.findMany({
      where: { caseId, entryType: 'gelir', receiptKey: { not: null } },
      take: 10,
    });
    for (const entry of receiptEntries) {
      if (!entry.receiptKey) continue;
      try {
        const content = await this.storage.download(entry.receiptKey);
        const ext = entry.receiptKey.split('.').pop() || 'bin';
        const filename = `Hizmet-Belge-${fileNo}-${entry.id.slice(0, 6)}.${ext}`;
        attachments.push({ filename, content });
        attachmentNames.push(filename);
      } catch (err: any) {
        this.logger.warn(`Kapanış fiş eki indirilemedi (${entry.id}): ${err?.message}`);
      }
    }

    const assistansName =
      emergencyCase.customer?.companyName
      || emergencyCase.customer?.fullName
      || 'Asistans Firması';

    return {
      to,
      recipients,
      greetingName,
      assistansName,
      subject,
      bodyText,
      html: `<pre style="font-family:Segoe UI,Arial,sans-serif;font-size:14px;line-height:1.5;color:#0f172a;white-space:pre-wrap">${bodyText
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')}</pre>`,
      attachmentNames,
      attachments,
      fileNo,
      caseStatus: emergencyCase.status,
    };
  }

  private resolveClosureGreetingName(fromName?: string | null, fromAddress?: string | null): string | null {
    const raw = (fromName || '').trim();
    if (raw) {
      // "Ad Soyad <mail>" veya "Ad Soyad" → Title Case benzeri ilk iki kelime
      const cleaned = raw.replace(/<[^>]+>/g, '').replace(/["']/g, '').trim();
      if (cleaned && !cleaned.includes('@')) {
        return cleaned
          .split(/\s+/)
          .slice(0, 3)
          .map((w) => w.charAt(0).toLocaleUpperCase('tr-TR') + w.slice(1).toLocaleLowerCase('tr-TR'))
          .join(' ');
      }
    }
    const local = (fromAddress || '').split('@')[0]?.trim();
    if (local && local.length >= 2 && !/^(info|destek|noreply|no-reply|mail|operasyon)/i.test(local)) {
      return local.charAt(0).toLocaleUpperCase('tr-TR') + local.slice(1);
    }
    return null;
  }

  async previewClosureEmail(caseId: string) {
    const payload = await this.buildClosureEmailPayload(caseId);
    return {
      data: {
        to: payload.to,
        recipients: payload.recipients,
        greetingName: payload.greetingName,
        assistansName: payload.assistansName,
        subject: payload.subject,
        body: payload.bodyText,
        attachmentNames: payload.attachmentNames,
        canSend: payload.recipients.length > 0,
        note: 'Tedarikçi alış fiyatı, kâr oranı ve iç operasyon bilgileri bu e-postada yer almaz.',
      },
    };
  }

  async sendClosureEmail(caseId: string) {
    const payload = await this.buildClosureEmailPayload(caseId);
    if (!payload.recipients.length) {
      throw new BadRequestException(
        'Gönderilecek e-posta adresi bulunamadı. İhbar gelen kutusu veya müşteri kartında e-posta olmalı.',
      );
    }
    if (payload.caseStatus !== 'COZULDU' && payload.caseStatus !== 'FATURALANDILDI') {
      throw new BadRequestException('Kapanış e-postası yalnızca kapatılmış dosyalar için gönderilebilir.');
    }

    const result = await this.emailService.sendEmail(
      payload.to,
      payload.subject,
      payload.html,
      {
        text: payload.bodyText,
        attachments: payload.attachments,
        mailbox: 'IHBAR',
      },
    );
    if (!result.sent || result.via !== 'graph') {
      throw new BadRequestException(
        result.errorMsg || 'Kapanış e-postası İhbar kutusundan gitmedi.',
      );
    }

    return {
      data: {
        sent: true,
        to: payload.to,
        recipients: payload.recipients,
        subject: payload.subject,
        attachmentNames: payload.attachmentNames,
        errorMsg: null,
      },
    };
  }

  /**
   * Sözlü müşteri kararı (Acil) — zorunlu açıklama + not kaydı + yönetici/müşteri maili.
   * customerApproved UI akışı frontend’de persistFlow ile senkronlanır.
   */
  async recordManualDecision(
    caseId: string,
    input: { action: 'approve' | 'reject' | 'revise'; reason: string },
    actor: { id?: string; userId?: string; roleCode?: string; role?: { code?: string } },
  ) {
    const role = actor?.roleCode ?? actor?.role?.code ?? '';
    if (PORTAL_ROLE_CODES.has(role) || !MERIDYEN_ROLE_CODES.has(role)) {
      throw new ForbiddenException('Manuel karar yalnız Meridyen personeli tarafından kaydedilebilir.');
    }
    const reason = (input.reason ?? '').trim();
    if (reason.length < MANUAL_DECISION_MIN_REASON) {
      throw new BadRequestException(`Açıklama en az ${MANUAL_DECISION_MIN_REASON} karakter olmalıdır.`);
    }
    if (!['approve', 'reject', 'revise'].includes(input.action)) {
      throw new BadRequestException('Geçersiz manuel karar işlemi.');
    }

    const emergencyCase = await this.prisma.emergencyCase.findUnique({
      where: { id: caseId },
      select: {
        id: true,
        caseNo: true,
        fileNo: true,
        notes: true,
        status: true,
        customer: {
          select: {
            email: true,
            shortName: true,
            companyName: true,
            fullName: true,
            firstName: true,
            lastName: true,
            contactFirstName: true,
            contactLastName: true,
            contacts: { select: { email: true, isPrimary: true }, take: 10 },
          },
        },
      },
    });
    if (!emergencyCase) throw new NotFoundException('Acil yardım dosyası bulunamadı.');

    const actorId = actor?.id ?? actor?.userId;
    const actorUser = actorId
      ? await this.prisma.user.findUnique({
          where: { id: actorId },
          select: { firstName: true, lastName: true },
        })
      : null;
    const actorName = `${actorUser?.firstName ?? ''} ${actorUser?.lastName ?? ''}`.trim() || 'Meridyen Personeli';
    const actionLabel =
      input.action === 'approve' ? 'Manuel Onay' : input.action === 'reject' ? 'Manuel Red' : 'Manuel Revizyon';
    const stamp = new Date().toISOString();
    const noteLine = `[${actionLabel} · ${stamp}] ${reason}`;
    const nextNotes = emergencyCase.notes?.trim()
      ? `${emergencyCase.notes.trim()}\n${noteLine}`
      : noteLine;

    // Onay: durum GELEN/ATANDI ise SAHADA’ya çekilmez — yalnız onay kaydı; red/revizyon not.
    let statusApplied: string = `acil_${input.action}_note`;
    if (input.action === 'approve' && (emergencyCase.status === 'GELEN' || emergencyCase.status === 'ATANDI')) {
      statusApplied = 'acil_customer_approved_note';
    }

    await this.prisma.emergencyCase.update({
      where: { id: caseId },
      data: { notes: nextNotes },
    });

    const processAction: EmergencyProcessAction | null =
      input.action === 'approve'
        ? 'EMERGENCY_CUSTOMER_APPROVED'
        : input.action === 'reject'
          ? 'EMERGENCY_CUSTOMER_REJECTED'
          : null;
    if (processAction) {
      const existingRows = await this.prisma.auditLog.findMany({
        where: {
          entityType: EMERGENCY_PROCESS_ENTITY_TYPE,
          entityId: caseId,
          action: processAction,
        },
        orderBy: { createdAt: 'desc' },
        take: 4,
      });
      const existing = existingRows.map((row) => ({
        action: row.action,
        createdAt: row.createdAt,
        metadata: parseEmergencyProcessPayload(row.newValue).metadata,
      }));
      if (!isEmergencyProcessDuplicate({ action: processAction, incomingMetadata: { reason }, existing })) {
        await this.prisma.auditLog.create({
          data: {
            entityType: EMERGENCY_PROCESS_ENTITY_TYPE,
            entityId: caseId,
            action: processAction,
            newValue: sanitizeAuditValue({
              description: emergencyProcessDescription(processAction),
              reason,
              ...(actorId
                ? await this.operationalAccessGrants.getFunctionDelegationStamp(actorId, 'acil_yardim') ?? {}
                : {}),
            }) as Prisma.InputJsonValue,
            userId: actorId ?? null,
            userEmail: (actor as { email?: string | null })?.email ?? null,
          },
        });
      }
    }

    const managers = await this.prisma.user.findMany({
      where: {
        status: 'active',
        role: { code: { in: ['admin', 'ADMIN', 'manager', 'MANAGER', 'ops_manager', 'OPS_MANAGER'] } },
      },
      select: { email: true },
      take: 40,
    });

    const customerEmail = resolveCustomerReminderEmail(emergencyCase.customer);
    const fileNo = emergencyCase.fileNo || emergencyCase.caseNo;

    void this.claimEventEmail.onManualDecision({
      action: input.action,
      fileNo,
      reason,
      actorName,
      emergencyCaseId: emergencyCase.id,
      customerEmail,
      managerEmails: managers.map((m) => m.email).filter(Boolean) as string[],
    });

    return {
      action: input.action,
      actionLabel,
      statusApplied,
      flowHint:
        input.action === 'approve'
          ? 'customerApproved'
          : input.action === 'reject'
            ? 'approvalRejected'
            : 'revisionRequested',
      customerNotified: Boolean(customerEmail),
      reason,
    };
  }

  // ─── Ara süreç (mevcut AuditLog; ClaimFile status değişmez) ───────────────

  async listProcessEvents(
    caseId: string,
    requestingUser?: RequestUser,
    insuranceCompanyIds?: string[],
    assistantCustomerIds?: string[],
  ) {
    await this.findOne(caseId, requestingUser, insuranceCompanyIds, assistantCustomerIds);
    const rows = await this.prisma.auditLog.findMany({
      where: {
        entityType: EMERGENCY_PROCESS_ENTITY_TYPE,
        entityId: caseId,
        action: { in: [...EMERGENCY_PROCESS_ACTIONS] },
      },
      orderBy: { createdAt: 'asc' },
    });
    return { data: rows.map((row) => this.mapProcessEvent(row)) };
  }

  async recordProcessEvent(
    caseId: string,
    dto: RecordEmergencyProcessEventDto,
    actor: { id?: string; email?: string | null },
    requestingUser?: RequestUser,
    insuranceCompanyIds?: string[],
    assistantCustomerIds?: string[],
  ) {
    await this.findOne(caseId, requestingUser, insuranceCompanyIds, assistantCustomerIds);
    if (!isEmergencyProcessAction(dto.action)) {
      throw new BadRequestException('Geçersiz acil süreç olayı');
    }
    const action: EmergencyProcessAction = dto.action;
    const metadata = (dto.metadata && typeof dto.metadata === 'object') ? dto.metadata : {};
    const description = (dto.description ?? '').trim() || emergencyProcessDescription(action, metadata);

    const existingRows = await this.prisma.auditLog.findMany({
      where: {
        entityType: EMERGENCY_PROCESS_ENTITY_TYPE,
        entityId: caseId,
        action,
      },
      orderBy: { createdAt: 'desc' },
      take: 12,
    });
    const existing = existingRows.map((row) => ({
      action: row.action,
      createdAt: row.createdAt,
      metadata: parseEmergencyProcessPayload(row.newValue).metadata,
    }));
    if (isEmergencyProcessDuplicate({ action, incomingMetadata: metadata, existing })) {
      const latest = existingRows[0];
      await this.applyOperationStamps(caseId, action);
      await this.applyVendorPaid(caseId, action, metadata);
      return { data: this.mapProcessEvent(latest), duplicate: true };
    }

    const payload = sanitizeAuditValue({ description, ...metadata }) as Prisma.InputJsonValue;
    const delegationStamp = actor.id
      ? await this.operationalAccessGrants.getFunctionDelegationStamp(actor.id, 'acil_yardim')
      : null;
    const created = await this.prisma.auditLog.create({
      data: {
        entityType: EMERGENCY_PROCESS_ENTITY_TYPE,
        entityId: caseId,
        action,
        newValue: (delegationStamp
          ? sanitizeAuditValue({ description, ...metadata, ...delegationStamp })
          : payload) as Prisma.InputJsonValue,
        userId: actor.id ?? null,
        userEmail: actor.email ?? null,
      },
    });
    await this.applyOperationStamps(caseId, action);
    await this.applyVendorPaid(caseId, action, metadata);
    return { data: this.mapProcessEvent(created), duplicate: false };
  }

  private async applyOperationStamps(caseId: string, action: string) {
    const current = await this.prisma.emergencyCase.findUnique({
      where: { id: caseId },
      select: { workStartedAt: true, serviceDeliveredAt: true },
    });
    const patch = nextAcilOperationStamps(action, current ?? {});
    if (!patch.workStartedAt && !patch.serviceDeliveredAt) return;
    await this.prisma.emergencyCase.update({
      where: { id: caseId },
      data: patch,
    });
  }

  private async applyVendorPaid(
    caseId: string,
    action: string,
    metadata: Record<string, unknown>,
  ) {
    if (action !== 'EMERGENCY_VENDOR_PAYMENT_RECORDED') return;
    if (metadata.paid !== true && metadata.paid !== false) return;
    await this.prisma.emergencyCase.update({
      where: { id: caseId },
      data: { vendorPaid: metadata.paid },
    });
  }

  private mapProcessEvent(row: {
    id: string;
    action: string;
    newValue: unknown;
    createdAt: Date;
    userId?: string | null;
  }) {
    const parsed = parseEmergencyProcessPayload(row.newValue);
    const description =
      parsed.description
      || (isEmergencyProcessAction(row.action)
        ? emergencyProcessDescription(row.action, parsed.metadata)
        : row.action);
    return {
      id: row.id,
      action: row.action,
      description,
      metadata: parsed.metadata,
      createdAt: row.createdAt.toISOString(),
      userId: row.userId ?? null,
    };
  }
}
