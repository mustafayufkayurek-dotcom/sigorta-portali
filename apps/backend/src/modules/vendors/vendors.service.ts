import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { applyTitleCase } from '@/common/utils/text-helpers';
import * as ExcelJS from 'exceljs';

@Injectable()
export class VendorsService {
  constructor(private prisma: PrismaService) {}

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

  private sanitizeVendorWriteData(rest: Record<string, unknown>): Record<string, unknown> {
    const { firstName, lastName, ...vendorData } = rest;
    if (!vendorData.name && (firstName || lastName)) {
      vendorData.name = `${String(firstName ?? '')} ${String(lastName ?? '')}`.trim();
    }
    applyTitleCase(vendorData, ['name']);
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
    await this.findOne(id);
    const { serviceAreas, workGroupIds, contacts, contactInfos, ...rest } = data;
    const vendorData = this.sanitizeVendorWriteData(rest);

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

  async remove(id: string) {
    await this.findOne(id);

    const [
      costCount,
      assignedFiles,
      statementCount,
      contractCount,
      paymentCount,
      emergencyCaseCount,
    ] = await Promise.all([
      this.prisma.costEntry.count({ where: { vendorId: id } }),
      this.prisma.claimFile.count({ where: { assignedSupplierId: id } }),
      this.prisma.vendorPaymentStatement.count({ where: { vendorId: id } }),
      this.prisma.vendorContract.count({ where: { vendorId: id } }),
      this.prisma.payment.count({ where: { payerId: id, payerType: 'vendor' } }),
      this.prisma.emergencyCase.count({ where: { assignedVendorId: id } }),
    ]);

    const blockers: string[] = [];
    if (costCount > 0) blockers.push(`${costCount} maliyet kaydı`);
    if (assignedFiles > 0) blockers.push(`${assignedFiles} atanmış hasar dosyası`);
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
    const { provinceId, city, workGroupId, category } = params;

    const where: any = { status: 'active' };

    // Filter by service area (province by id or city name)
    if (provinceId || city) {
      where.serviceAreas = {
        some: provinceId
          ? { provinceId }
          : { province: { name: { equals: city, mode: 'insensitive' } } },
      };
    }

    // Filter by work group
    if (workGroupId) {
      where.vendorWorkGroups = { some: { workGroupId } };
    }

    const vendors = await this.prisma.vendor.findMany({
      where,
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
      take: 50,
    });

    // Compute stats per vendor
    const results = await Promise.all(
      vendors.map(async (v) => {
        const [completedJobs, activeJobs, avgAmount] = await Promise.all([
          this.prisma.costEntry.count({ where: { vendorId: v.id } }),
          this.prisma.costEntry.count({
            where: { vendorId: v.id, claimFile: { currentStatus: { isClosedState: false } } },
          }),
          category
            ? this.prisma.costEntry.aggregate({
                where: { vendorId: v.id, category },
                _avg: { amount: true },
              }).then((r) => r._avg.amount)
            : Promise.resolve(null),
        ]);

        const availableCapacity: null = null;
        const score = completedJobs * 2 + 10;

        return { ...v, stats: { completedJobs, activeJobs, avgAmount, availableCapacity }, score };
      }),
    );

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, 10).map(({ score, ...v }) => v);
  }
}
