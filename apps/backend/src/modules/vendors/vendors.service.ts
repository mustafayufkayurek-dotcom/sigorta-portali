import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { applyTitleCase } from '@/common/utils/text-helpers';
import { VendorRecommendationService } from './vendor-recommendation.service';
import { VendorCostMemoryService } from '@/modules/vendor-cost-memory/vendor-cost-memory.service';
import { AuditLogsService } from '@/modules/audit-logs/audit-logs.service';
import {
  compareAccountHolderToVendor,
  formatIbanForMessage,
  normalizeAndValidateVendorIban,
} from './vendor-bank-confirmation.util';
import * as ExcelJS from 'exceljs';

@Injectable()
export class VendorsService {
  constructor(
    private prisma: PrismaService,
    private readonly vendorRecommendation: VendorRecommendationService,
    private readonly vendorCostMemory: VendorCostMemoryService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  private mapVendorContactInput(c: any, vendorId: string) {
    const fullName =
      (c.fullName && String(c.fullName).trim()) ||
      `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() ||
      '—';
    return {
      vendorId,
      fullName,
      title: c.title ?? null,
      phone: c.phone ?? null,
      phoneType: c.phoneType === 'landline' ? 'landline' : 'gsm',
      phoneExtension: c.phoneExtension ?? c.extensionNo ?? null,
      email: c.email ?? null,
      birthDate: c.birthDate ? new Date(c.birthDate) : null,
      isPrimary: c.isPrimary ?? false,
    };
  }

  async contractExpiring(days: number) {
    const now = new Date();
    const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const expiring = await this.prisma.vendor.findMany({
      where: {
        status: 'active',
        contractEndDate: { not: null, gt: now, lte: future },
      },
      select: { id: true, name: true, contractEndDate: true, contractStartDate: true, contractNotes: true },
      orderBy: { contractEndDate: 'asc' },
    });

    const expired = await this.prisma.vendor.findMany({
      where: {
        status: 'active',
        contractEndDate: { not: null, lt: now },
      },
      select: { id: true, name: true, contractEndDate: true, contractStartDate: true, contractNotes: true },
      orderBy: { contractEndDate: 'asc' },
    });

    return { expiring, expired, expiringCount: expiring.length, expiredCount: expired.length };
  }

  async findAll(params?: { page?: number; limit?: number; type?: string; city?: string; status?: string; search?: string; entityType?: string; workGroupId?: string; serviceRegion?: string; category?: string }) {
    const page = Number(params?.page) || 1;
    const limit = Number(params?.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params?.status) where.status = params.status;
    if (params?.type) where.type = params.type;
    if (params?.entityType) where.entityType = params.entityType;
    if (params?.city) where.city = { contains: params.city, mode: 'insensitive' };
    if (params?.category) {
      where.category = { in: [params.category, 'her_ikisi'] };
    }
    if (params?.serviceRegion) {
      where.serviceAreas = {
        some: {
          province: { name: { contains: params.serviceRegion, mode: 'insensitive' } },
        },
      };
    }
    if (params?.workGroupId) {
      where.vendorWorkGroups = { some: { workGroupId: params.workGroupId } };
    }
    if (params?.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { email: { contains: params.search, mode: 'insensitive' } },
        { phone: { contains: params.search, mode: 'insensitive' } },
        { taxNumber: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.vendor.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          createdByUser: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { serviceAreas: true, vendorWorkGroups: true, costEntries: true } },
          costEntries: {
            orderBy: { entryDate: 'desc' },
            take: 1,
            select: { entryDate: true },
          },
        },
      }),
      this.prisma.vendor.count({ where }),
    ]);

    const data = rows.map(({ costEntries, createdByUser, ...v }) => ({
      ...v,
      createdByUser,
      lastJobDate: costEntries[0]?.entryDate ?? null,
    }));

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async getSummary() {
    const [total, activeCount, corporateCount] = await Promise.all([
      this.prisma.vendor.count(),
      this.prisma.vendor.count({ where: { status: 'active' } }),
      this.prisma.vendor.count({ where: { entityType: 'corporate' } }),
    ]);
    return { total, activeCount, corporateCount };
  }

  async findOne(id: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id },
      include: {
        serviceAreas: {
          include: {
            province: { select: { id: true, plateCode: true, name: true } },
            district: { select: { id: true, name: true } },
          },
        },
        vendorWorkGroups: {
          include: {
            workGroup: { select: { id: true, code: true, name: true, sortOrder: true } },
          },
        },
        contacts: {
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        },
        contactInfos: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!vendor) throw new NotFoundException('Tedarikçi bulunamadı');
    return vendor;
  }

  private sanitizeVendorWriteData(
    rest: Record<string, unknown>,
    existing?: Record<string, any>,
  ): Record<string, unknown> {
    const {
      firstName,
      lastName,
      bankName: _ignoredBankName,
      ibanAccountHolderMatchStatus: _ignoredMatchStatus,
      ibanWhatsappConfirmStatus: _ignoredConfirmStatus,
      ibanWhatsappConfirmPhone: _ignoredConfirmPhone,
      ibanWhatsappConfirmSentAt: _ignoredConfirmSentAt,
      ibanWhatsappConfirmAt: _ignoredConfirmAt,
      ibanWhatsappConfirmByUserId: _ignoredConfirmBy,
      ...vendorData
    } = rest;
    if (!vendorData.name && (firstName || lastName)) {
      vendorData.name = `${String(firstName ?? '')} ${String(lastName ?? '')}`.trim();
    }
    applyTitleCase(vendorData, ['name']);

    const hasIban = Object.prototype.hasOwnProperty.call(vendorData, 'iban');
    const hasAccountHolder = Object.prototype.hasOwnProperty.call(
      vendorData,
      'accountHolderName',
    );
    const hasName = Object.prototype.hasOwnProperty.call(vendorData, 'name');
    if (hasIban) {
      const normalized = normalizeAndValidateVendorIban(vendorData.iban);
      vendorData.iban = normalized.iban;
      vendorData.bankName = normalized.bankName;
    }
    if (hasAccountHolder) {
      const trimmed = String(vendorData.accountHolderName ?? '')
        .replace(/\s+/g, ' ')
        .trim();
      vendorData.accountHolderName = trimmed || null;
    }

    if (hasIban || hasAccountHolder || hasName) {
      const effectiveIban = hasIban ? vendorData.iban : existing?.iban;
      const effectiveHolder = hasAccountHolder
        ? vendorData.accountHolderName
        : existing?.accountHolderName;
      const effectiveName = hasName ? vendorData.name : existing?.name;
      vendorData.ibanAccountHolderMatchStatus = effectiveIban
        ? compareAccountHolderToVendor(effectiveHolder, effectiveName)
        : 'unknown';
    }

    const ibanChanged =
      !!existing && hasIban && vendorData.iban !== (existing.iban ?? null);
    const holderChanged =
      !!existing &&
      hasAccountHolder &&
      vendorData.accountHolderName !== (existing.accountHolderName ?? null);
    if (ibanChanged || holderChanged) {
      vendorData.ibanWhatsappConfirmStatus = null;
      vendorData.ibanWhatsappConfirmPhone = null;
      vendorData.ibanWhatsappConfirmSentAt = null;
      vendorData.ibanWhatsappConfirmAt = null;
      vendorData.ibanWhatsappConfirmByUserId = null;
    }
    return vendorData;
  }

  async create(data: any, createdByUserId?: string) {
    const { serviceAreas, workGroupIds, contacts, contactInfos, ...rest } = data;
    const vendorData = this.sanitizeVendorWriteData(rest);
    const vendor = await this.prisma.vendor.create({
      data: {
        ...(vendorData as any),
        ...(createdByUserId ? { createdByUserId } : {}),
      },
    });

    if (serviceAreas?.length) {
      await this.prisma.vendorServiceArea.createMany({
        data: serviceAreas.map((sa: any) => ({
          vendorId: vendor.id,
          provinceId: sa.provinceId,
          districtId: sa.districtId ?? null,
        })),
        skipDuplicates: true,
      });
    }

    if (workGroupIds?.length) {
      await this.prisma.vendorWorkGroup.createMany({
        data: workGroupIds.map((wgId: string) => ({ vendorId: vendor.id, workGroupId: wgId })),
        skipDuplicates: true,
      });
    }

    if (contacts?.length) {
      await this.prisma.vendorContact.createMany({
        data: contacts.map((c: any) => this.mapVendorContactInput(c, vendor.id)),
      });
    }

    if (contactInfos?.length) {
      await this.prisma.contactInfo.createMany({
        data: contactInfos.map((ci: any) => ({
          entityType: 'vendor',
          entityId: vendor.id,
          vendorId: vendor.id,
          type: ci.type,
          value: ci.value,
          label: ci.label ?? 'general',
        })),
      });
    }

    return this.findOne(vendor.id);
  }

  async update(id: string, data: any) {
    const existing = await this.findOne(id);
    const { serviceAreas, workGroupIds, contacts, contactInfos, ...rest } = data;
    const vendorData = this.sanitizeVendorWriteData(rest, existing as any);

    await this.prisma.vendor.update({ where: { id }, data: vendorData as any });

    if (serviceAreas !== undefined) {
      await this.prisma.vendorServiceArea.deleteMany({ where: { vendorId: id } });
      if (serviceAreas.length) {
        await this.prisma.vendorServiceArea.createMany({
          data: serviceAreas.map((sa: any) => ({
            vendorId: id,
            provinceId: sa.provinceId,
            districtId: sa.districtId ?? null,
          })),
          skipDuplicates: true,
        });
      }
    }

    if (workGroupIds !== undefined) {
      await this.prisma.vendorWorkGroup.deleteMany({ where: { vendorId: id } });
      if (workGroupIds.length) {
        await this.prisma.vendorWorkGroup.createMany({
          data: workGroupIds.map((wgId: string) => ({ vendorId: id, workGroupId: wgId })),
          skipDuplicates: true,
        });
      }
    }

    if (contacts !== undefined) {
      await this.prisma.vendorContact.deleteMany({ where: { vendorId: id } });
      if (contacts.length) {
        await this.prisma.vendorContact.createMany({
          data: contacts.map((c: any) => this.mapVendorContactInput(c, id)),
        });
      }
    }

    if (contactInfos !== undefined) {
      await this.prisma.contactInfo.deleteMany({ where: { vendorId: id } });
      if (contactInfos.length) {
        await this.prisma.contactInfo.createMany({
          data: contactInfos.map((ci: any) => ({
            entityType: 'vendor',
            entityId: id,
            vendorId: id,
            type: ci.type,
            value: ci.value,
            label: ci.label ?? 'general',
          })),
        });
      }
    }

    return this.findOne(id);
  }

  async offerBankConfirmationWhatsapp(id: string, phone: string | undefined, userId: string) {
    const vendor = await this.findOne(id);
    if (!vendor.iban || !vendor.accountHolderName) {
      throw new BadRequestException(
        'WhatsApp teyidi için IBAN ve hesap sahibi bilgisi gereklidir.',
      );
    }

    const recipientPhone = String(phone || vendor.phone || '').replace(/\D/g, '');
    if (!recipientPhone) {
      throw new BadRequestException('WhatsApp teyidi için telefon numarası gereklidir.');
    }
    const internationalPhone = recipientPhone.startsWith('0')
      ? `90${recipientPhone.slice(1)}`
      : recipientPhone.startsWith('90')
        ? recipientPhone
        : recipientPhone.length === 10
          ? `90${recipientPhone}`
          : recipientPhone;
    const message = [
      `Merhaba ${vendor.name},`,
      '',
      'Meridyen Assistance kayıtlarındaki ödeme bilgilerinizi teyit etmenizi rica ederiz.',
      `Hesap Sahibi: ${vendor.accountHolderName}`,
      `IBAN: ${formatIbanForMessage(vendor.iban)}`,
      `Banka: ${vendor.bankName ?? 'Banka adı otomatik belirlenemedi'}`,
      '',
      'Bilgiler doğruysa “Onaylıyorum”, düzeltme varsa doğru bilgileri yazmanızı rica ederiz.',
      'Bu mesaj bilgilendirme amaçlıdır.',
    ].join('\n');
    const waUrl = `https://wa.me/${internationalPhone}?text=${encodeURIComponent(message)}`;
    const sentAt = new Date();

    await this.prisma.vendor.update({
      where: { id },
      data: {
        ibanWhatsappConfirmStatus: 'offered',
        ibanWhatsappConfirmPhone: internationalPhone,
        ibanWhatsappConfirmSentAt: sentAt,
        ibanWhatsappConfirmAt: null,
        ibanWhatsappConfirmByUserId: null,
      },
    });
    this.auditLogsService.log({
      entityType: 'vendor',
      entityId: id,
      action: 'VENDOR_BANK_CONFIRMATION_OFFERED',
      newValue: { status: 'offered' },
      userId,
    });

    return { waUrl, status: 'offered', sentAt };
  }

  async markBankConfirmationWhatsappOpened(id: string, userId: string) {
    const vendor = await this.findOne(id);
    if (!vendor.ibanWhatsappConfirmSentAt) {
      throw new BadRequestException('Önce WhatsApp teyit mesajı hazırlanmalıdır.');
    }
    const data = await this.prisma.vendor.update({
      where: { id },
      data: { ibanWhatsappConfirmStatus: 'link_opened' },
    });
    this.auditLogsService.log({
      entityType: 'vendor',
      entityId: id,
      action: 'VENDOR_BANK_CONFIRMATION_LINK_OPENED',
      newValue: { status: 'link_opened' },
      userId,
    });
    return data;
  }

  async setBankConfirmationStatus(
    id: string,
    status: 'confirmed' | 'declined',
    userId: string,
  ) {
    await this.findOne(id);
    const confirmedAt = new Date();
    const data = await this.prisma.vendor.update({
      where: { id },
      data: {
        ibanWhatsappConfirmStatus: status,
        ibanWhatsappConfirmAt: confirmedAt,
        ibanWhatsappConfirmByUserId: userId,
      },
    });
    this.auditLogsService.log({
      entityType: 'vendor',
      entityId: id,
      action:
        status === 'confirmed'
          ? 'VENDOR_BANK_CONFIRMATION_CONFIRMED'
          : 'VENDOR_BANK_CONFIRMATION_DECLINED',
      newValue: { status },
      userId,
    });
    return data;
  }

  async remove(id: string) {
    await this.findOne(id);

    const [
      costCount,
      assignedFiles,
      supplierLinks,
      statementCount,
      contractCount,
      paymentCount,
      emergencyCaseCount,
    ] = await Promise.all([
      this.prisma.costEntry.count({ where: { vendorId: id } }),
      this.prisma.claimFile.count({ where: { assignedSupplierId: id } }),
      this.prisma.claimFileSupplier.count({ where: { vendorId: id } }),
      this.prisma.vendorPaymentStatement.count({ where: { vendorId: id } }),
      this.prisma.vendorContract.count({ where: { vendorId: id } }),
      this.prisma.payment.count({ where: { payerId: id, payerType: 'vendor' } }),
      this.prisma.emergencyCase.count({ where: { assignedVendorId: id } }),
    ]);

    const blockers: string[] = [];
    if (costCount > 0) blockers.push(`${costCount} maliyet kaydı`);
    if (assignedFiles > 0 || supplierLinks > 0) {
      const totalAssigned = Math.max(assignedFiles, supplierLinks);
      blockers.push(`${totalAssigned} atanmış hasar dosyası`);
    }
    if (statementCount > 0) blockers.push(`${statementCount} ekstre`);
    if (contractCount > 0) blockers.push(`${contractCount} sözleşme`);
    if (paymentCount > 0) blockers.push(`${paymentCount} ödeme kaydı`);
    if (emergencyCaseCount > 0) blockers.push(`${emergencyCaseCount} acil vaka`);

    if (blockers.length > 0) {
      throw new BadRequestException(
        `Bu tedarikçi silinemez. İlişkili kayıtlar: ${blockers.join(', ')}. Önce kayıtları temizleyin veya tedarikçiyi pasife alın.`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.appointment.updateMany({ where: { vendorId: id }, data: { vendorId: null } });
      await tx.budgetItem.updateMany({ where: { vendorId: id }, data: { vendorId: null } });
      await tx.repairItemAnomalyFlag.updateMany({ where: { vendorId: id }, data: { vendorId: null } });
      await tx.claimFileSupplier.deleteMany({ where: { vendorId: id } });
      await tx.claimFile.updateMany({ where: { assignedSupplierId: id }, data: { assignedSupplierId: null } });
      await tx.vendorDisputeAlert.deleteMany({ where: { vendorId: id } });
      await tx.vendorStatementDispute.deleteMany({ where: { vendorId: id } });
      await tx.vendor.delete({ where: { id } });
    });

    return { message: 'Tedarikçi silindi' };
  }

  async checkDuplicate(field: 'phone' | 'email', value: string, excludeId?: string) {
    // 1. Vendor tablosunda doğrudan alan kontrolü
    const vendorWhere: any = { [field]: value };
    if (excludeId) vendorWhere.id = { not: excludeId };
    const vendorMatch = await this.prisma.vendor.findFirst({
      where: vendorWhere,
      select: { id: true, name: true, entityType: true },
    });
    if (vendorMatch) {
      return { exists: true, existingRecord: { id: vendorMatch.id, name: vendorMatch.name, entityType: vendorMatch.entityType, sourceType: 'vendor' as const } };
    }

    // 2. ContactInfo tablosunda kontrol (hem tedarikçi hem müşteri)
    const ciWhere: any = { type: field, value };
    if (excludeId) ciWhere.NOT = { vendorId: excludeId };
    const ciMatch = await this.prisma.contactInfo.findFirst({
      where: ciWhere,
      include: {
        vendor: { select: { id: true, name: true, entityType: true } },
        customer: { select: { id: true, fullName: true, firstName: true, lastName: true, companyName: true, entityType: true } },
      },
    });
    if (ciMatch) {
      if (ciMatch.vendor) {
        return { exists: true, existingRecord: { id: ciMatch.vendor.id, name: ciMatch.vendor.name, entityType: ciMatch.vendor.entityType, sourceType: 'vendor' as const } };
      }
      if (ciMatch.customer) {
        const c = ciMatch.customer;
        const name = c.entityType === 'individual'
          ? `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || c.fullName || '—'
          : c.companyName || '—';
        return { exists: true, existingRecord: { id: c.id, name: `Müşteri: ${name}`, entityType: c.entityType, sourceType: 'customer' as const } };
      }
    }

    // 3. Customer tablosunda doğrudan alan kontrolü (cross-entity)
    const customerMatch = await this.prisma.customer.findFirst({
      where: { [field]: value },
      select: { id: true, fullName: true, firstName: true, lastName: true, companyName: true, entityType: true },
    });
    if (customerMatch) {
      const name = customerMatch.entityType === 'individual'
        ? `${customerMatch.firstName ?? ''} ${customerMatch.lastName ?? ''}`.trim() || customerMatch.fullName || '—'
        : customerMatch.companyName || '—';
      return { exists: true, existingRecord: { id: customerMatch.id, name: `Müşteri: ${name}`, entityType: customerMatch.entityType, sourceType: 'customer' as const } };
    }

    return { exists: false };
  }

  async getStats(id: string) {
    await this.findOne(id);

    const [completedJobs, activeJobs, avgByCategory] = await Promise.all([
      this.prisma.costEntry.count({ where: { vendorId: id } }),
      this.prisma.costEntry.count({
        where: {
          vendorId: id,
          claimFile: { currentStatus: { isClosedState: false } },
        },
      }),
      this.prisma.costEntry.groupBy({
        by: ['category'],
        where: { vendorId: id },
        _avg: { amount: true },
        _count: { id: true },
      }),
    ]);

    return { completedJobs, activeJobs, avgByCategory };
  }

  async getProfileOverview(id: string) {
    await this.findOne(id);

    const [
      operationSummary,
      costSummary,
      qualitySummary,
      fileHistory,
      whatsappHistory,
    ] = await Promise.all([
      this.buildOperationSummary(id),
      this.buildCostSummary(id),
      this.buildQualitySummary(id),
      this.buildFileHistory(id),
      this.buildWhatsappHistory(id),
    ]);

    return {
      operationSummary,
      costSummary,
      qualitySummary,
      fileHistory,
      whatsappHistory,
    };
  }

  private async buildOperationSummary(id: string) {
    const [
      metrics,
      overallCostMemory,
      latestOperation,
      repeatWorkRate,
      closedEmergencyCount,
      activeEmergencyCount,
    ] = await Promise.all([
      this.vendorRecommendation.getOperationMetrics(id),
      this.vendorCostMemory.getVendorSummary({ vendorId: id, months: 12 }),
      this.findLatestOperation(id),
      this.calculateRepeatWorkRate(id),
      this.prisma.emergencyCase.count({
        where: { assignedVendorId: id, status: { in: ['COZULDU', 'FATURALANDILDI'] } },
      }),
      this.prisma.emergencyCase.count({
        where: { assignedVendorId: id, status: { notIn: ['COZULDU', 'FATURALANDILDI'] } },
      }),
    ]);

    const completedOperations = metrics.completedFileCount + closedEmergencyCount;
    const activeOperations = metrics.activeFileCount + activeEmergencyCount;
    const totalOperations = completedOperations + activeOperations;
    const denominator = completedOperations + activeOperations + metrics.cancelledCaseCount;
    const successRate = denominator > 0
      ? Math.round((completedOperations / denominator) * 100)
      : null;

    return {
      totalOperations,
      completedOperations,
      activeOperations,
      lastOperation: latestOperation,
      avgResponseTimeHours: metrics.avgResponseTimeHours,
      avgCompletionTimeHours: overallCostMemory?.avgDurationHours ?? null,
      repeatWorkRate,
      complaintCount: metrics.disputeCount,
      successRate,
    };
  }

  private async buildCostSummary(id: string) {
    const points = await this.vendorCostMemory.collectMemoryPoints({
      vendorIds: [id],
      months: 12,
      limitPerVendor: 120,
    });

    const grouped = new Map<string, typeof points>();
    for (const point of points) {
      const key = point.operationGroup?.trim()
        || point.canonicalLabel?.trim()
        || point.serviceType?.trim()
        || point.originalServiceType?.trim()
        || 'Genel';
      const list = grouped.get(key) ?? [];
      list.push(point);
      grouped.set(key, list);
    }

    return Array.from(grouped.entries())
      .map(([serviceType, rows]) => {
        const sorted = [...rows].sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime());
        const costs = rows
          .map((row) => row.actualCost)
          .filter((value): value is number => Number.isFinite(value) && value > 0);
        if (costs.length === 0) return null;
        const avg = Math.round(costs.reduce((sum, value) => sum + value, 0) / costs.length);
        return {
          serviceType,
          operationGroup: sorted[0]?.operationGroup ?? null,
          count: costs.length,
          minCost: Math.min(...costs),
          avgCost: avg,
          maxCost: Math.max(...costs),
          lastCost: sorted[0]?.actualCost ?? null,
          lastDate: sorted[0]?.recordedAt?.toISOString() ?? null,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row != null)
      .sort((a, b) => b.count - a.count || a.serviceType.localeCompare(b.serviceType, 'tr'));
  }

  private async buildQualitySummary(id: string) {
    const emergencyCaseIds = (
      await this.prisma.emergencyCase.findMany({
        where: { assignedVendorId: id },
        select: { id: true },
        take: 200,
      })
    ).map((row) => row.id);

    const [claimResponses, emergencyResponses] = await Promise.all([
      this.prisma.surveyResponse.findMany({
        where: {
          campaign: {
            claimFile: {
              OR: [
                { assignedSupplierId: id },
                { supplierAssignments: { some: { vendorId: id } } },
              ],
            },
          },
        },
        select: {
          q1Rating: true,
          q2Rating: true,
          q3Rating: true,
          q4Rating: true,
          q5Rating: true,
          q6Recommend: true,
        },
      }),
      this.prisma.surveyResponse.findMany({
        where: {
          campaign: {
            emergencyCaseId: { in: emergencyCaseIds.length ? emergencyCaseIds : ['__none__'] },
          },
        },
        select: {
          q1Rating: true,
          q2Rating: true,
          q3Rating: true,
          q4Rating: true,
          q5Rating: true,
          q6Recommend: true,
        },
      }),
    ]);

    const responses = [...claimResponses, ...emergencyResponses];
    const average = (values: number[]) => {
      if (values.length === 0) return null;
      const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
      return Math.round(avg * 10) / 10;
    };

    const ratings = {
      overallSatisfaction: average(responses.map((row) => row.q1Rating)),
      onTimeIntervention: average(responses.map((row) => row.q2Rating)),
      communicationQuality: average(responses.map((row) => row.q3Rating)),
      photoQuality: average(responses.map((row) => row.q4Rating)),
      documentQuality: average(responses.map((row) => row.q5Rating)),
    };
    const recommendCount = responses.filter((row) => row.q6Recommend).length;
    const recommendRate = responses.length > 0
      ? Math.round((recommendCount / responses.length) * 100)
      : null;

    return {
      responseCount: responses.length,
      recommendRate,
      ...ratings,
    };
  }

  private async buildFileHistory(id: string) {
    const files = await this.prisma.claimFile.findMany({
      where: {
        OR: [
          { assignedSupplierId: id },
          { supplierAssignments: { some: { vendorId: id } } },
        ],
      },
      take: 50,
      orderBy: [
        { closedAt: 'desc' },
        { updatedAt: 'desc' },
      ],
      select: {
        id: true,
        fileNo: true,
        claimNo: true,
        insuredName: true,
        lossType: true,
        createdAt: true,
        closedAt: true,
        updatedAt: true,
        propertyAddress: { select: { city: true, district: true } },
        insuranceCompany: { select: { id: true, name: true } },
        currentStatus: { select: { code: true, name: true, color: true, isClosedState: true } },
        claimSubject: { select: { name: true } },
      },
    });

    return files.map((file) => ({
      id: file.id,
      fileNo: file.fileNo,
      claimNo: file.claimNo,
      insuredName: file.insuredName,
      serviceType: file.claimSubject?.name ?? file.lossType ?? null,
      city: file.propertyAddress?.city ?? null,
      district: file.propertyAddress?.district ?? null,
      insuranceCompanyName: file.insuranceCompany?.name ?? null,
      status: file.currentStatus,
      createdAt: file.createdAt.toISOString(),
      updatedAt: file.updatedAt.toISOString(),
      closedAt: file.closedAt?.toISOString() ?? null,
    }));
  }

  private async buildWhatsappHistory(id: string) {
    const claimFiles = await this.prisma.claimFile.findMany({
      where: {
        OR: [
          { assignedSupplierId: id },
          { supplierAssignments: { some: { vendorId: id } } },
        ],
      },
      select: { id: true, fileNo: true },
      take: 80,
      orderBy: { updatedAt: 'desc' },
    });
    const claimFileIds = claimFiles.map((file) => file.id);
    const fileNoById = new Map(claimFiles.map((file) => [file.id, file.fileNo]));
    if (claimFileIds.length === 0) return [];

    const [archives, documents] = await Promise.all([
      this.prisma.chatArchive.findMany({
        where: { claimFileId: { in: claimFileIds } },
        take: 20,
        orderBy: { uploadedAt: 'desc' },
        select: {
          id: true,
          claimFileId: true,
          label: true,
          uploadedAt: true,
          uploadedBy: { select: { firstName: true, lastName: true } },
          parsedMessages: true,
        },
      }),
      this.prisma.fileDocument.findMany({
        where: {
          entityType: 'claim_file',
          entityId: { in: claimFileIds },
          whatsappSentAt: { not: null },
        },
        take: 20,
        orderBy: { whatsappSentAt: 'desc' },
        select: {
          id: true,
          entityId: true,
          documentKind: true,
          whatsappSentAt: true,
          whatsappPhone: true,
        },
      }),
    ]);

    const history = [
      ...archives.map((archive) => ({
        id: archive.id,
        type: 'chat_archive',
        claimFileId: archive.claimFileId,
        fileNo: fileNoById.get(archive.claimFileId) ?? null,
        label: archive.label,
        sentAt: archive.uploadedAt.toISOString(),
        messageCount: Array.isArray(archive.parsedMessages) ? archive.parsedMessages.length : 0,
        contact: archive.uploadedBy
          ? `${archive.uploadedBy.firstName} ${archive.uploadedBy.lastName}`.trim()
          : null,
      })),
      ...documents.map((document) => ({
        id: document.id,
        type: 'file_document',
        claimFileId: document.entityId,
        fileNo: fileNoById.get(document.entityId) ?? null,
        label: document.documentKind,
        sentAt: document.whatsappSentAt?.toISOString() ?? null,
        messageCount: null,
        contact: document.whatsappPhone ?? null,
      })),
    ];

    history.sort((a, b) => {
      const left = a.sentAt ? new Date(a.sentAt).getTime() : 0;
      const right = b.sentAt ? new Date(b.sentAt).getTime() : 0;
      return right - left;
    });

    return history.slice(0, 24);
  }

  private async findLatestOperation(id: string) {
    const [latestClaimFile, latestEmergencyCase] = await Promise.all([
      this.prisma.claimFile.findFirst({
        where: {
          OR: [
            { assignedSupplierId: id },
            { supplierAssignments: { some: { vendorId: id } } },
          ],
          currentStatus: { isClosedState: true },
        },
        orderBy: { closedAt: 'desc' },
        select: {
          id: true,
          fileNo: true,
          closedAt: true,
          claimSubject: { select: { name: true } },
          lossType: true,
        },
      }),
      this.prisma.emergencyCase.findFirst({
        where: {
          assignedVendorId: id,
          status: { in: ['COZULDU', 'FATURALANDILDI'] },
        },
        orderBy: { resolvedAt: 'desc' },
        select: {
          id: true,
          caseNo: true,
          issueType: true,
          resolvedAt: true,
          status: true,
        },
      }),
    ]);

    const claimClosedAt = latestClaimFile?.closedAt?.getTime() ?? 0;
    const emergencyClosedAt = latestEmergencyCase?.resolvedAt?.getTime() ?? 0;

    if (!latestClaimFile && !latestEmergencyCase) return null;
    if (claimClosedAt >= emergencyClosedAt && latestClaimFile) {
      return {
        type: 'claim_file',
        id: latestClaimFile.id,
        referenceNo: latestClaimFile.fileNo,
        serviceType: latestClaimFile.claimSubject?.name ?? latestClaimFile.lossType ?? null,
        completedAt: latestClaimFile.closedAt?.toISOString() ?? null,
      };
    }

    return {
      type: 'emergency_case',
      id: latestEmergencyCase!.id,
      referenceNo: latestEmergencyCase!.caseNo,
      serviceType: latestEmergencyCase!.issueType ?? null,
      completedAt: latestEmergencyCase!.resolvedAt?.toISOString() ?? null,
    };
  }

  private async calculateRepeatWorkRate(id: string) {
    const files = await this.prisma.claimFile.findMany({
      where: {
        OR: [
          { assignedSupplierId: id },
          { supplierAssignments: { some: { vendorId: id } } },
        ],
        currentStatus: { isClosedState: true },
      },
      select: {
        insuranceCompanyId: true,
      },
    });

    if (files.length === 0) return null;
    const counts = new Map<string, number>();
    for (const file of files) {
      const key = file.insuranceCompanyId;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const repeatedCount = Array.from(counts.values())
      .filter((count) => count > 1)
      .reduce((sum, count) => sum + count, 0);

    return Math.round((repeatedCount / files.length) * 100);
  }

  async updateServiceAreas(id: string, serviceAreas: Array<{ provinceId: string; districtId?: string | null }>) {
    await this.findOne(id);
    await this.prisma.vendorServiceArea.deleteMany({ where: { vendorId: id } });
    if (serviceAreas.length) {
      await this.prisma.vendorServiceArea.createMany({
        data: serviceAreas.map((sa) => ({
          vendorId: id,
          provinceId: sa.provinceId,
          districtId: sa.districtId ?? null,
        })),
        skipDuplicates: true,
      });
    }
    return this.findOne(id);
  }

  async updateWorkGroups(id: string, workGroupIds: string[]) {
    await this.findOne(id);
    await this.prisma.vendorWorkGroup.deleteMany({ where: { vendorId: id } });
    if (workGroupIds.length) {
      await this.prisma.vendorWorkGroup.createMany({
        data: workGroupIds.map((wgId) => ({ vendorId: id, workGroupId: wgId })),
        skipDuplicates: true,
      });
    }
    return this.findOne(id);
  }

  async bulkUpdateStatus(ids: string[], status: string) {
    await this.prisma.vendor.updateMany({
      where: { id: { in: ids } },
      data: { status } as any,
    });
    return { updated: ids.length };
  }

  async exportToExcel(ids: string[]): Promise<Buffer> {
    const vendors = await this.prisma.vendor.findMany({
      where: ids.length ? { id: { in: ids } } : undefined,
      include: {
        vendorWorkGroups: {
          include: { workGroup: { select: { name: true } } },
        },
        serviceAreas: {
          include: {
            province: { select: { name: true } },
            district: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Tedarikçiler');

    sheet.columns = [
      { header: 'Firma / İsim', key: 'name', width: 32 },
      { header: 'Telefon', key: 'phone', width: 18 },
      { header: 'Faaliyet Alanı', key: 'faaliyetAlani', width: 30 },
      { header: 'Hizmet Bölgesi', key: 'hizmetBolgesi', width: 35 },
      { header: 'Durum', key: 'durum', width: 12 },
      { header: 'Referans', key: 'referans', width: 24 },
    ];

    // Header styling
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 22;

    const statusLabel: Record<string, string> = {
      active: 'Aktif',
      passive: 'Pasif',
    };

    for (const v of vendors) {
      const faaliyetAlani = v.vendorWorkGroups.map((vwg: any) => vwg.workGroup?.name ?? '').filter(Boolean).join(', ');
      const hizmetBolgesi = v.serviceAreas
        .map((sa: any) => sa.districtId ? `${sa.province?.name}/${sa.district?.name ?? ''}` : `${sa.province?.name} (Tümü)`)
        .join(', ');

      sheet.addRow({
        name: v.name ?? '',
        phone: (v as any).phone ?? '',
        faaliyetAlani,
        hizmetBolgesi,
        durum: statusLabel[(v as any).status ?? ''] ?? (v as any).status ?? '',
        referans: (v as any).referral ?? '',
      });
    }

    // Alternate row shading
    sheet.eachRow((row, rowNum) => {
      if (rowNum > 1) {
        row.eachCell((cell) => {
          cell.alignment = { vertical: 'middle' };
          if (rowNum % 2 === 0) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FF' } };
          }
        });
      }
    });

    const buf = await workbook.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  async suggest(params: { provinceId?: string; city?: string; workGroupId?: string; category?: string }) {
    const recommendations = await this.vendorRecommendation.recommend({
      provinceId: params.provinceId,
      city: params.city,
      workGroupId: params.workGroupId,
      category: params.category,
      limit: 3,
    });
    if (recommendations.length === 0) return [];

    const vendors = await this.prisma.vendor.findMany({
      where: { id: { in: recommendations.map((r) => r.id) } },
      include: {
        serviceAreas: {
          include: {
            province: { select: { id: true, name: true } },
            district: { select: { id: true, name: true } },
          },
        },
        vendorWorkGroups: {
          include: { workGroup: { select: { id: true, code: true, name: true } } },
        },
      },
    });

    const rankById = new Map(recommendations.map((r) => [r.id, r]));
    return vendors
      .map((vendor) => {
        const rec = rankById.get(vendor.id);
        if (!rec) return null;
        return {
          ...vendor,
          operationGroup: rec.operationGroup ?? rec.costMemory?.operationGroup ?? null,
          canonicalLabel: rec.canonicalLabel ?? rec.costMemory?.canonicalLabel ?? null,
          originalServiceType:
            rec.originalServiceType ?? rec.costMemory?.originalServiceType ?? null,
          stats: {
            completedJobs: rec.completedFileCount,
            activeJobs: 0,
            avgAmount: rec.avgCost,
            availableCapacity: null,
            costMemory: rec.costMemory ?? null,
            recommendationScore: rec.compositeScore,
            avgServiceScore: rec.avgServiceScore,
            avgResponseTime: rec.avgResponseTime,
            expertiseMatchScore: rec.expertiseMatchScore ?? null,
          },
        };
      })
      .filter((v): v is NonNullable<typeof v> => v != null)
      .sort((a, b) => (rankById.get(a.id)?.rank ?? 99) - (rankById.get(b.id)?.rank ?? 99));
  }
}
