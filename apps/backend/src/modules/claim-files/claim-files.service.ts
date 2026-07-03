import { Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException, Optional, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { isFieldStaff } from '@/common/helpers/field-staff.helper';
import { canViewFileFinancials, normalizeFinancialVisibilityConfig, resolveFinancialVisibilityConfig, canManageFinancialVisibility } from '@/common/helpers/financial-visibility.helper';
import { ClaimEventEmailService } from '@/modules/notifications/email/claim-event-email.service';
import { SmsService } from '@/modules/notifications/sms/sms.service';
import { MessageTemplateService, TEMPLATE_TYPES } from '@/modules/notifications/sms/message-template.service';
import { AuditLogsService } from '@/modules/audit-logs/audit-logs.service';
import { CacheService } from '@/cache/cache.service';

const ACCESS_EXPIRY_HOURS = 48;

const APPROVED_REPAIR_REPORT_STATUSES = ['approved', 'externally_approved'] as const;

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
  ) {}

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

  async findAll(params?: {
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
  }, requestingUser?: { id: string; roleCode: string }) {
    const page = Number(params?.page) || 1;
    const limit = Number(params?.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params?.statusId) where.currentStatusId = params.statusId;
    if (params?.insuranceCompanyId) where.insuranceCompanyId = params.insuranceCompanyId;
    if (params?.assignedFieldUserId) where.assignedFieldUserId = params.assignedFieldUserId;
    if (params?.assignedOfficeUserId) where.assignedOfficeUserId = params.assignedOfficeUserId;
    if (params?.assignedAdjusterId) where.assignedAdjusterId = params.assignedAdjusterId;
    if (params?.insuranceCompanyIds?.length) {
      where.insuranceCompanyId = { in: params.insuranceCompanyIds };
    }
    if (params?.invoiceStatus) {
      if (params.invoiceStatus === 'none') {
        where.invoices = { none: {} };
      } else {
        where.invoices = { some: { status: params.invoiceStatus } };
      }
    }
    if (params?.repairReportStatus) {
      where.repairReports = { some: { status: params.repairReportStatus } };
    }

    // Saha personeli sadece kendine atanmış dosyaları görür
    if (requestingUser && isFieldStaff(requestingUser.roleCode)) {
      where.assignedFieldUserId = requestingUser.id;
      // 48 saat erişim süresi: kapanıp 48h geçmiş dosyalar listeden çıkar
      const expiryThreshold = new Date(Date.now() - ACCESS_EXPIRY_HOURS * 60 * 60 * 1000);
      where.OR = [
        { closedAt: null },
        { closedAt: { gt: expiryThreshold } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.claimFile.findMany({
        where,
        skip,
        take: limit,
        include: {
          insuranceCompany: true,
          currentStatus: true,
          customer: true,
          assignedBranch: true,
          assignedFieldUser: { select: { id: true, firstName: true, lastName: true } },
          assignedOfficeUser: { select: { id: true, firstName: true, lastName: true } },
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
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.claimFile.count({ where }),
    ]);

    const dataWithReports = await this.attachLatestRepairReports(data);

    return {
      data: dataWithReports,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
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
        assignedSupplier: { select: { id: true, name: true, city: true, district: true, type: true } },
        currentResponsibleUser: { select: { id: true, firstName: true, lastName: true } },
        assignedAdjuster: { select: { id: true, firstName: true, lastName: true } },
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

    // Saha personeli sahiplik + 48 saat erişim süresi kontrolü
    if (requestingUser && isFieldStaff(requestingUser.roleCode)) {
      if (claimFile.assignedFieldUserId !== requestingUser.id) {
        throw new ForbiddenException('Bu dosyaya erişim izniniz bulunmamaktadır');
      }
      // 48 saat kapanma süresi kontrolü
      if (claimFile.closedAt) {
        const expiryMs = ACCESS_EXPIRY_HOURS * 60 * 60 * 1000;
        const expiry = new Date((claimFile.closedAt as Date).getTime() + expiryMs);
        if (new Date() > expiry) {
          throw new ForbiddenException('Bu dosya için erişim süreniz dolmuştur');
        }
      }
    }

    const reports = await this.prisma.repairReport.findMany({
      where: { claimFileId: id },
      orderBy: { updatedAt: 'desc' },
      select: LATEST_REPAIR_REPORT_SELECT,
    });
    const latestReport = pickPreferredRepairReport(reports);

    return {
      ...claimFile,
      latestRepairReport: latestReport ? formatLatestRepairReport(latestReport) : null,
      financialVisibilityConfig: resolveFinancialVisibilityConfig(claimFile),
      canViewFinancials: requestingUser
        ? canViewFileFinancials(requestingUser, claimFile)
        : true,
      canManageFinancialVisibility: requestingUser
        ? canManageFinancialVisibility(requestingUser.roleCode)
        : false,
    };
  }

  async create(data: any) {
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
    const policyNo = typeof rest.policyNo === 'string' ? rest.policyNo.trim() : '';
    const claimNo = typeof rest.claimNo === 'string' ? rest.claimNo.trim() : '';
    const productBranch = typeof rest.productBranch === 'string' ? rest.productBranch.trim() : '';
    const lossType = typeof rest.lossType === 'string' ? rest.lossType.trim() : '';

    // Domain Ayrıştırma: claimSubjectId tercih, departmentFileSubjectId backward-compat
    const claimSubjectId = rest.claimSubjectId ?? null;
    const departmentFileSubjectId = rest.departmentFileSubjectId ?? null;
    const departmentId = rest.departmentId ?? null;

    if (!insuranceCompanyId) throw new BadRequestException('Sigorta şirketi zorunludur');
    if (!policyNo) throw new BadRequestException('Poliçe numarası zorunludur');
    if (!claimNo) throw new BadRequestException('Hasar numarası zorunludur');
    if (!productBranch) throw new BadRequestException('Ürün branşı zorunludur');
    if (!lossType) throw new BadRequestException('Hasar türü zorunludur');

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
      const created = await this.prisma.claimFile.create({
        data: {
          ...rest,
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
          departmentId,
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

      // In-app bildirim: Yeni dosya oluşturuldu, saha/ofis personeline bildir
      const customerName =
        (created.customer as any)?.fullName ??
        (created.customer as any)?.companyName ??
        'Bilinmiyor';
      const addressText = (created as any)?.propertyAddress?.addressLine ?? '';
      const notifBody = `Yeni dosya atandı: ${created.fileNo} - ${customerName}${addressText ? ' - ' + addressText : ''}`;

      const notifTargets: Array<{ id: string }> = [];
      if (created.assignedFieldUserId) notifTargets.push({ id: created.assignedFieldUserId });
      if (created.assignedOfficeUserId && created.assignedOfficeUserId !== created.assignedFieldUserId) {
        notifTargets.push({ id: created.assignedOfficeUserId });
      }
      for (const t of notifTargets) {
        void this.createInAppNotification({
          userId: t.id,
          type: 'file_assignment',
          title: 'Yeni Dosya Atandı',
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
    await this.findOne(id);

    if (data.financialVisibilityConfig !== undefined) {
      if (!canManageFinancialVisibility(requestingUser?.roleCode)) {
        throw new ForbiddenException('Finansal görünürlük ayarını yalnızca yönetici değiştirebilir');
      }
      data.financialVisibilityConfig = normalizeFinancialVisibilityConfig(data.financialVisibilityConfig);
      data.hideFinancialFromAssignees = false;
    }

    if (data.hideFinancialFromAssignees !== undefined && data.hideFinancialFromAssignees !== false) {
      if (!canManageFinancialVisibility(requestingUser?.roleCode)) {
        throw new ForbiddenException('Finansal görünürlük ayarını yalnızca yönetici değiştirebilir');
      }
    }

    // fileNo değiştirilmeye çalışılıyorsa çakışma kontrolü
    if (data.fileNo?.trim()) {
      const { exists } = await this.checkFileNo(data.fileNo.trim(), id, 'hasar');
      if (exists) {
        throw new ConflictException('Bu dosya numarası zaten kullanılıyor');
      }
    }

    const updated = await this.prisma.claimFile.update({
      where: { id },
      data,
      include: { currentStatus: true },
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
    if (dto.assignedFieldUserId !== undefined) updateData.assignedFieldUserId = dto.assignedFieldUserId;
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
    const claimWhere: any = { fileNo };
    if (excludeType === 'hasar' && excludeId) claimWhere.id = { not: excludeId };
    const existingClaim = await this.prisma.claimFile.findFirst({
      where: claimWhere,
      select: { id: true },
    });
    if (existingClaim) {
      return { exists: true, usedBy: 'hasar', matchedRecord: { id: existingClaim.id } };
    }

    return { exists: false, usedBy: null, matchedRecord: null };
  }

  // ── Ofis-Saha İş Akışı ────────────────────────────────────────────────────

  private async logActivity(params: {
    claimFileId: string;
    action: 'SUPPLIER_ASSIGNED' | 'APPOINTMENT_SCHEDULED' | 'APPOINTMENT_UPDATED' | 'INSPECTION_DONE' | 'COST_REPORT_SUBMITTED' | 'ATTACHMENT_ADDED' | 'STATUS_CHANGED' | 'NOTE_ADDED';
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

  async assignSupplier(fileId: string, supplierId: string, actor: any, note?: string) {
    const file = await this.prisma.claimFile.findUnique({
      where: { id: fileId },
      include: { assignedSupplier: true },
    });
    if (!file) throw new NotFoundException('Dosya bulunamadı.');

    const vendor = await this.prisma.vendor.findUnique({ where: { id: supplierId } });
    if (!vendor) throw new NotFoundException('Tedarikçi bulunamadı.');

    const statusId = await this.getOrCreateStatusByCode('SUPPLIER_ASSIGNED');

    const updated = await this.prisma.claimFile.update({
      where: { id: fileId },
      data: {
        assignedSupplierId: supplierId,
        supplierAssignedAt: new Date(),
        ...(statusId ? { currentStatusId: statusId } : {}),
      },
      include: { assignedSupplier: true, currentStatus: true },
    });

    await this.logActivity({
      claimFileId: fileId,
      action: 'SUPPLIER_ASSIGNED',
      actorId: actor.id,
      actorRole: actor.role?.code ?? 'unknown',
      description: `Tedarikçi "${vendor.name}" atandı.`,
      metadata: { supplierId, supplierName: vendor.name, note },
    });

    // Tedarikçinin kullanıcısına bildirim gönder (user.vendorId alanı varsa)
    try {
      const vendorUser = await this.prisma.user.findFirst({
        where: { status: 'active' },
        select: { id: true },
      });
      if (vendorUser) {
        await this.createInAppNotification({
          userId: vendorUser.id,
          type: 'supplier_assigned',
          title: 'Yeni Dosya Atandı',
          body: `${file.fileNo} numaralı dosya size atandı.`,
          relatedEntityId: fileId,
        });
      }
    } catch {}

    return updated;
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
      await this.prisma.claimFile.update({ where: { id: fileId }, data: { currentStatusId: statusId } });
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
    const updateData: any = { ...(statusId ? { currentStatusId: statusId } : {}) };
    if (body.estimatedCost !== undefined) updateData.estimatedCostAmount = body.estimatedCost;
    if (Object.keys(updateData).length) {
      await this.prisma.claimFile.update({ where: { id: fileId }, data: updateData });
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
        ...(statusId ? { currentStatusId: statusId } : {}),
      },
    });

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

  async getNearbyVendors(fileId: string) {
    const file = await this.prisma.claimFile.findUnique({
      where: { id: fileId },
      include: { propertyAddress: true },
    });
    if (!file) throw new NotFoundException('Dosya bulunamadı.');

    const city = file.propertyAddress?.city;

    const vendors = await this.prisma.vendor.findMany({
      where: {
        status: 'active',
        ...(city ? {
          OR: [
            { city },
            { serviceAreas: { some: { province: { name: city } } } },
          ],
        } : {}),
      },
      select: {
        id: true, name: true, type: true, phone: true, email: true,
        city: true, district: true, category: true,
        serviceAreas: { include: { province: true, district: true } },
      },
      take: 20,
      orderBy: { name: 'asc' },
    });

    return vendors;
  }
}
