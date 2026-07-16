import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EmergencyStatus } from '@prisma/client';
import { isFieldStaff } from '@/common/helpers/field-staff.helper';
import { isInsuranceCompanyUser, mergeWhereAnd, RequestUser } from '@/common/helpers/claim-file-scope.helper';
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

@Injectable()
export class EmergencyCasesService {
  private readonly logger = new Logger(EmergencyCasesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly operationalAccessGrants: OperationalAccessGrantsService,
    private readonly fileDocumentsService: FileDocumentsService,
    private readonly invoiceRequestsService: InvoiceRequestsService,
    private readonly vendorProfile: VendorIntelligenceProfileService,
  ) {}

  /** EPIC-04: Kapanışta tedarikçi hakediş entegrasyon noktası (onay sonrası VendorStatements bağlanacak). */
  private async onEmergencyCaseClosed(caseId: string, userId: string): Promise<void> {
    const emergencyCase = await this.prisma.emergencyCase.findUnique({
      where: { id: caseId },
      select: { id: true, caseNo: true, assignedVendorId: true },
    });
    if (!emergencyCase?.assignedVendorId) {
      this.logger.debug(`[EPIC-04] Kapanış hakediş atlandı — tedarikçi yok: ${caseId}`);
      return;
    }
    this.logger.log(
      `[EPIC-04] Kapanış hakediş entegrasyonu bekliyor — case=${emergencyCase.caseNo} vendor=${emergencyCase.assignedVendorId}`,
    );
    await this.ensureFinanceTransfer(caseId, userId).catch((err) =>
      this.logger.warn(`[EPIC-04] Otomatik finans aktarımı atlandı: ${err?.message}`),
    );
    await this.vendorProfile.onFileCompleted({ type: 'emergency_case', id: caseId }).catch((err) =>
      this.logger.warn(`[VendorIntelligenceProfile] Acil kapanış hook: ${err?.message}`),
    );
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
    return { ...c, overdueLevel, totalGelir, totalGider, netKar: totalGelir - totalGider };
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
    const [emergencyCase, inboundMessages, documents, invoiceRequests, closure] = await Promise.all([
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
        assignedUserId: dto.assignedUserId,
        notes: dto.notes,
        createdByUserId: userId,
      },
      include: { assignedVendor: true, assignedUser: true, costEntries: true },
    });
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
    }

    if (this.operationalAccessGrants.isDelegationScopedRole(requestingUser.roleCode)) {
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
  ) {
    const where: any = await this.buildListScope(
      { customerId: filters.customerId },
      requestingUser,
      insuranceCompanyIds,
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
      include: {
        assignedVendor: { select: { id: true, name: true } },
        assignedUser: { select: { id: true, firstName: true, lastName: true } },
        customer: {
          select: {
            id: true,
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
  ) {
    const c = await this.prisma.emergencyCase.findUnique({
      where: { id },
      include: {
        assignedVendor: { select: { id: true, name: true } },
        assignedUser: { select: { id: true, firstName: true, lastName: true } },
        customer: {
          select: {
            id: true,
            fullName: true,
            companyName: true,
            firstName: true,
            lastName: true,
            entityType: true,
            subType: true,
          },
        },
        costEntries: { orderBy: { entryDate: 'asc' } },
        invoiceItems: { include: { draft: true } },
      },
    });
    if (!c) throw new NotFoundException('Acil vaka bulunamadı');
    await this.assertCaseAccess(c, requestingUser, insuranceCompanyIds);

    const activeDelegation = requestingUser
      ? await this.operationalAccessGrants.resolveDelegationBanner(
          requestingUser.id,
          c.assignedUserId,
          'acil_yardim',
        )
      : null;

    const operationChain = await this.buildOperationChain(id);
    return { data: { ...this.enrichCase(c), activeDelegation, operationChain } };
  }

  async update(id: string, dto: UpdateEmergencyCaseDto) {
    await this.findOne(id);

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
      },
      include: { assignedVendor: true, assignedUser: true, costEntries: true },
    });
    return { data: this.enrichCase(updated) };
  }

  async updateStatus(id: string, dto: UpdateEmergencyStatusDto, userId = 'system') {
    await this.findOne(id);
    const data: any = { status: dto.status };
    if (dto.status === EmergencyStatus.COZULDU) data.resolvedAt = new Date();
    if (dto.status === EmergencyStatus.FATURALANDILDI) data.invoicedAt = new Date();
    const updated = await this.prisma.emergencyCase.update({
      where: { id },
      data,
      include: { assignedVendor: true, assignedUser: true, costEntries: true },
    });
    if (dto.status === EmergencyStatus.COZULDU) {
      await this.onEmergencyCaseClosed(id, userId).catch((err) =>
        this.logger.warn(`[EPIC-04] Kapanış hook hatası: ${err?.message}`),
      );
    }
    if (dto.status === EmergencyStatus.FATURALANDILDI) {
      await this.onEmergencyCaseInvoiced(id, userId).catch((err) =>
        this.logger.warn(`[EPIC-04] Finans aktarım hook hatası: ${err?.message}`),
      );
    }
    return { data: this.enrichCase(updated) };
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
}
