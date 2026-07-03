import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { isFieldStaff } from '@/common/helpers/field-staff.helper';
import { applyTitleCase } from '@/common/utils/text-helpers';
import * as ExcelJS from 'exceljs';

type CustomerNameFields = {
  entityType?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  companyName?: string | null;
  authorizedPerson?: string | null;
  taxNumber?: string | null;
};

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  /** Çakışma uyarılarında gösterilecek okunaklı müşteri adı */
  private resolveCustomerDisplayName(c: CustomerNameFields): string {
    if (c.entityType === 'individual') {
      const personal = `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim();
      return personal || c.fullName?.trim() || c.companyName?.trim() || 'Kayıtlı Müşteri';
    }
    return (
      c.companyName?.trim()
      || c.fullName?.trim()
      || c.authorizedPerson?.trim()
      || (c.taxNumber ? `Kurumsal Müşteri (VKN: ${c.taxNumber})` : 'Kayıtlı Kurumsal Müşteri')
    );
  }

  /**
   * FIELD_STAFF için: kendi atandığı dosyalardaki müşterileri döner
   */
  async getMyCustomers(requestingUser: { id: string; roleCode: string }) {
    const customers = await this.prisma.customer.findMany({
      where: {
        claimFiles: { some: { assignedFieldUserId: requestingUser.id } },
      },
      include: {
        claimFiles: {
          where: { assignedFieldUserId: requestingUser.id },
          include: {
            currentStatus: { select: { isClosedState: true, name: true } },
          },
          orderBy: { updatedAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return customers.map((c) => {
      const name =
        c.entityType === 'individual'
          ? `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || '—'
          : c.companyName || '—';

      const totalFiles = c.claimFiles.length;
      const openFiles = c.claimFiles.filter((f) => !f.currentStatus.isClosedState).length;
      const closedFiles = totalFiles - openFiles;
      const lastActivityDate = c.claimFiles[0]?.updatedAt ?? c.createdAt;

      return {
        customerId: c.id,
        name,
        phone: c.phone,
        totalFiles,
        openFiles,
        closedFiles,
        lastActivityDate,
        files: c.claimFiles.map((f) => ({
          id: f.id,
          fileNo: f.fileNo,
          statusName: f.currentStatus.name,
          isClosed: f.currentStatus.isClosedState,
          updatedAt: f.updatedAt,
        })),
      };
    });
  }

  async getOverdueCount(requestingUser?: { id: string; roleCode: string }): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const where: any = {
      status: 'active',
      followUpDate: { lt: today },
    };

    if (requestingUser && isFieldStaff(requestingUser.roleCode)) {
      where.claimFiles = { some: { assignedFieldUserId: requestingUser.id } };
    }

    return this.prisma.customer.count({ where });
  }

  async getOverdueCustomers(requestingUser?: { id: string; roleCode: string }) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const where: any = {
      status: 'active',
      followUpDate: { lt: today },
    };

    if (requestingUser && isFieldStaff(requestingUser.roleCode)) {
      where.claimFiles = { some: { assignedFieldUserId: requestingUser.id } };
    }

    const customers = await this.prisma.customer.findMany({
      where,
      take: 3,
      orderBy: { followUpDate: 'asc' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        companyName: true,
        entityType: true,
        followUpDate: true,
      },
    });

    return customers.map((c) => {
      const name =
        c.entityType === 'individual'
          ? `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || '—'
          : c.companyName || '—';
      return { id: c.id, name, followUpDate: c.followUpDate };
    });
  }

  async findAll(
    params?: {
      page?: number;
      limit?: number;
      type?: string;
      search?: string;
      customerType?: string;
      subType?: string;
      serviceType?: string;
      status?: string;
      tags?: string | string[];
      source?: string;
      followUpOverdue?: string;
    },
    requestingUser?: { id: string; roleCode: string },
  ) {
    const page = Number(params?.page) || 1;
    const limit = Number(params?.limit) || 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (params?.type) where.type = params.type;
    if (params?.customerType) (where as any).entityType = params.customerType;
    if (params?.subType) {
      // Legacy kayıtlar sub_type=eksper; yeni kayıtlar eksper_firmasi
      (where as any).subType =
        params.subType === 'eksper_firmasi'
          ? { in: ['eksper_firmasi', 'eksper'] }
          : params.subType;
    }
    if (params?.serviceType) {
      const normalized = params.serviceType.trim().toLowerCase().replace(/-/g, '_');
      if (normalized === 'acil_yardim') {
        (where as any).serviceType = { in: ['acil_yardim', 'ACIL_YARDIM'] };
      } else if (normalized === 'hasar') {
        (where as any).serviceType = { in: ['hasar', 'HASAR'] };
      } else {
        (where as any).serviceType = params.serviceType;
      }
    }
    if (params?.status) (where as any).status = params.status;
    if (params?.source) (where as any).source = params.source;

    if (params?.followUpOverdue === 'true') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (!(where as any).status) (where as any).status = 'active';
      (where as any).followUpDate = { lt: today };
    }

    if (params?.tags) {
      const tagArray = Array.isArray(params.tags) ? params.tags : [params.tags];
      const filtered = tagArray.filter((t) => t && t.trim());
      if (filtered.length) {
        (where as any).tags = { hasSome: filtered };
      }
    }
    if (params?.search) {
      (where as any).OR = [
        { fullName: { contains: params.search, mode: 'insensitive' } },
        { companyName: { contains: params.search, mode: 'insensitive' } },
        { email: { contains: params.search, mode: 'insensitive' } },
        { phone: { contains: params.search } },
        { identityNo: { contains: params.search } },
        { taxNumber: { contains: params.search } },
      ];
    }

    // Saha personeli sadece kendi atandığı dosyaların müşterilerini görür
    if (requestingUser && isFieldStaff(requestingUser.roleCode)) {
      where.claimFiles = {
        some: { assignedFieldUserId: requestingUser.id },
      };
    }

    const [rawData, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip,
        take: limit,
        include: {
          contacts: true,
          _count: { select: { claimFiles: true } },
          claimFiles: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.customer.count({ where }),
    ]);

    const data = rawData.map(({ claimFiles, ...rest }) => ({
      ...rest,
      lastActivityDate: claimFiles[0]?.createdAt ?? null,
    }));

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        contacts: true,
        contactInfos: { orderBy: { createdAt: 'asc' } },
        _count: { select: { claimFiles: true } },
      },
    });
    if (!customer) {
      throw new NotFoundException('Müşteri bulunamadı');
    }
    return customer;
  }

  /**
   * Ham (maskelenmemiş) müşteri kaydını döndürür — sadece click-to-call için
   */
  async findOneRaw(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      select: { id: true, phone: true, fullName: true, companyName: true },
    });
    if (!customer) {
      throw new NotFoundException('Müşteri bulunamadı');
    }
    return customer;
  }

  async create(data: any) {
    const { contacts, contactInfos, customerType, ...rest } = data as any;
    this.sanitizeCustomerWriteData(rest);

    // entityType / type eşleme
    if (customerType && !rest.entityType) {
      rest.entityType = customerType;
    }
    if (rest.entityType === 'individual' && !rest.type) {
      rest.type = 'individual';
    } else if (rest.entityType === 'corporate' && !rest.type) {
      rest.type = 'corporate';
    }

    // Title Case — isim alanları
    applyTitleCase(rest, ['firstName', 'lastName', 'companyName', 'contactFirstName', 'contactLastName']);

    // fullName compute
    if (rest.entityType === 'individual' && rest.firstName && rest.lastName && !rest.fullName) {
      rest.fullName = `${rest.firstName} ${rest.lastName}`.trim();
    }

    // DateTime alanlarını düzelt (boş string -> null, DD.MM.YYYY veya YYYY-MM-DD -> ISO)
    rest.followUpDate = this.parseDate(rest.followUpDate);
    rest.birthDate = this.parseDate(rest.birthDate);

    const customer = await this.prisma.customer.create({ data: rest }).catch((err: any) => {
      if (err?.code === 'P2002') {
        const field = err?.meta?.target?.[0] ?? 'alan';
        const fieldLabel: Record<string, string> = {
          identity_no: 'TC Kimlik No',
          tax_number: 'Vergi No',
          phone: 'Telefon',
          email: 'E-posta',
        };
        throw new ConflictException(`Bu ${fieldLabel[field] ?? field} zaten kayıtlı`);
      }
      throw err;
    });

    if (contacts?.length) {
      const valid = contacts.filter((c: any) => c.name?.trim());
      if (valid.length) {
        await this.prisma.customerContact.createMany({
          data: valid.map((c: any) => ({
            customerId: customer.id,
            name: c.name,
            role: c.role ?? null,
            phone: c.phone ?? null,
            email: c.email ?? null,
            isPrimary: c.isPrimary ?? false,
          })),
        });
      }
    }

    if (contactInfos?.length) {
      const valid = contactInfos.filter((ci: any) => ci.value?.trim());
      if (valid.length) {
        await this.prisma.contactInfo.createMany({
          data: valid.map((ci: any) => ({
            entityType: 'customer',
            entityId: customer.id,
            customerId: customer.id,
            type: ci.type,
            value: ci.value,
            label: ci.label ?? 'general',
          })),
        });
      }
    }

    return this.findOne(customer.id);
  }

  async update(id: string, data: any) {
    await this.findOne(id);
    const { contacts, contactInfos, customerType, ...rest } = data as any;
    this.sanitizeCustomerWriteData(rest);
    if (customerType && !rest.entityType) {
      rest.entityType = customerType;
    }

    // Title Case — isim alanları
    applyTitleCase(rest, ['firstName', 'lastName', 'companyName', 'contactFirstName', 'contactLastName']);

    if (rest.entityType === 'individual' && rest.firstName && rest.lastName && !rest.fullName) {
      rest.fullName = `${rest.firstName} ${rest.lastName}`.trim();
    }

    // DateTime alanlarını düzelt
    rest.followUpDate = this.parseDate(rest.followUpDate);
    rest.birthDate = this.parseDate(rest.birthDate);

    await this.prisma.customer.update({ where: { id }, data: rest }).catch((err: any) => {
      if (err?.code === 'P2002') {
        const field = err?.meta?.target?.[0] ?? 'alan';
        const fieldLabel: Record<string, string> = {
          identity_no: 'TC Kimlik No',
          tax_number: 'Vergi No',
          phone: 'Telefon',
          email: 'E-posta',
        };
        throw new ConflictException(`Bu ${fieldLabel[field] ?? field} zaten kayıtlı`);
      }
      throw err;
    });

    if (contacts !== undefined) {
      await this.prisma.customerContact.deleteMany({ where: { customerId: id } });
      const valid = contacts.filter((c: any) => c.name?.trim());
      if (valid.length) {
        await this.prisma.customerContact.createMany({
          data: valid.map((c: any) => ({
            customerId: id,
            name: c.name,
            role: c.role ?? null,
            phone: c.phone ?? null,
            email: c.email ?? null,
            isPrimary: c.isPrimary ?? false,
          })),
        });
      }
    }

    if (contactInfos !== undefined) {
      await this.prisma.contactInfo.deleteMany({ where: { customerId: id } });
      const valid = contactInfos.filter((ci: any) => ci.value?.trim());
      if (valid.length) {
        await this.prisma.contactInfo.createMany({
          data: valid.map((ci: any) => ({
            entityType: 'customer',
            entityId: id,
            customerId: id,
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
    await this.prisma.customer.delete({ where: { id } });
    return { message: 'Müşteri silindi' };
  }

  async checkDuplicate(
    params: { phone?: string; email?: string; tc?: string; taxNumber?: string; firstName?: string; lastName?: string },
    excludeId?: string,
  ) {
    const { phone, email, tc, taxNumber, firstName, lastName } = params;

    // ── TC Kimlik No kontrolü ──────────────────────────────────────────────
    if (tc) {
      const where: any = { identityNo: tc };
      if (excludeId) where.id = { not: excludeId };
      const match = await this.prisma.customer.findFirst({
        where,
        select: { id: true, fullName: true, firstName: true, lastName: true, companyName: true, entityType: true },
      });
      if (match) {
        const name = this.resolveCustomerDisplayName(match);
        return { exists: true, field: 'tc' as const, existingRecord: { id: match.id, fullName: name, type: 'customer' as const } };
      }
    }

    // ── Vergi No kontrolü ────────────────────────────────────────────────
    if (taxNumber) {
      const where: any = { taxNumber };
      if (excludeId) where.id = { not: excludeId };
      const match = await this.prisma.customer.findFirst({
        where,
        select: {
          id: true, fullName: true, firstName: true, lastName: true, companyName: true,
          entityType: true, authorizedPerson: true, taxNumber: true,
        },
      });
      if (match) {
        const name = this.resolveCustomerDisplayName(match);
        return { exists: true, field: 'taxNumber' as const, existingRecord: { id: match.id, fullName: name, type: 'customer' as const } };
      }
    }

    // ── Telefon kontrolü ──────────────────────────────────────────────────
    if (phone) {
      const customerWhere: any = { phone };
      if (excludeId) customerWhere.id = { not: excludeId };
      const customerMatch = await this.prisma.customer.findFirst({
        where: customerWhere,
        select: { id: true, fullName: true, firstName: true, lastName: true, companyName: true, entityType: true },
      });
      if (customerMatch) {
        const name = customerMatch.entityType === 'individual'
          ? `${customerMatch.firstName ?? ''} ${customerMatch.lastName ?? ''}`.trim() || customerMatch.fullName || '—'
          : customerMatch.companyName || '—';
        return { exists: true, field: 'phone' as const, existingRecord: { id: customerMatch.id, fullName: name, type: 'customer' as const } };
      }

      // ContactInfo tablosunda kontrol
      const ciWhere: any = { type: 'phone', value: phone };
      if (excludeId) ciWhere.NOT = { customerId: excludeId };
      const ciMatch = await this.prisma.contactInfo.findFirst({
        where: ciWhere,
        include: {
          customer: { select: { id: true, fullName: true, firstName: true, lastName: true, companyName: true, entityType: true } },
          vendor: { select: { id: true, name: true } },
        },
      });
      if (ciMatch?.customer) {
        const c = ciMatch.customer;
        const name = c.entityType === 'individual'
          ? `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || c.fullName || '—'
          : c.companyName || '—';
        return { exists: true, field: 'phone' as const, existingRecord: { id: c.id, fullName: name, type: 'customer' as const } };
      }
      if (ciMatch?.vendor) {
        return { exists: true, field: 'phone' as const, existingRecord: { id: ciMatch.vendor.id, fullName: `Tedarikçi: ${ciMatch.vendor.name}`, type: 'vendor' as const } };
      }

      // Vendor tablosu
      const vendorMatch = await this.prisma.vendor.findFirst({
        where: { phone },
        select: { id: true, name: true },
      });
      if (vendorMatch) {
        return { exists: true, field: 'phone' as const, existingRecord: { id: vendorMatch.id, fullName: `Tedarikçi: ${vendorMatch.name}`, type: 'vendor' as const } };
      }
    }

    // ── E-posta kontrolü ──────────────────────────────────────────────────
    if (email) {
      const customerWhere: any = { email };
      if (excludeId) customerWhere.id = { not: excludeId };
      const customerMatch = await this.prisma.customer.findFirst({
        where: customerWhere,
        select: { id: true, fullName: true, firstName: true, lastName: true, companyName: true, entityType: true },
      });
      if (customerMatch) {
        const name = customerMatch.entityType === 'individual'
          ? `${customerMatch.firstName ?? ''} ${customerMatch.lastName ?? ''}`.trim() || customerMatch.fullName || '—'
          : customerMatch.companyName || '—';
        return { exists: true, field: 'email' as const, existingRecord: { id: customerMatch.id, fullName: name, type: 'customer' as const } };
      }

      const ciWhere: any = { type: 'email', value: email };
      if (excludeId) ciWhere.NOT = { customerId: excludeId };
      const ciMatch = await this.prisma.contactInfo.findFirst({
        where: ciWhere,
        include: {
          customer: { select: { id: true, fullName: true, firstName: true, lastName: true, companyName: true, entityType: true } },
          vendor: { select: { id: true, name: true } },
        },
      });
      if (ciMatch?.customer) {
        const c = ciMatch.customer;
        const name = c.entityType === 'individual'
          ? `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || c.fullName || '—'
          : c.companyName || '—';
        return { exists: true, field: 'email' as const, existingRecord: { id: c.id, fullName: name, type: 'customer' as const } };
      }
      if (ciMatch?.vendor) {
        return { exists: true, field: 'email' as const, existingRecord: { id: ciMatch.vendor.id, fullName: `Tedarikçi: ${ciMatch.vendor.name}`, type: 'vendor' as const } };
      }
    }

    // ── İsim + Soyisim kontrolü (sadece uyarı — blocking değil) ─────────
    if (firstName && lastName) {
      const fullNameSearch = `${firstName} ${lastName}`.trim();
      const where: any = {
        OR: [
          { fullName: { equals: fullNameSearch, mode: 'insensitive' } },
          { AND: [
            { firstName: { equals: firstName, mode: 'insensitive' } },
            { lastName: { equals: lastName, mode: 'insensitive' } },
          ]},
        ],
      };
      if (excludeId) where.id = { not: excludeId };
      const match = await this.prisma.customer.findFirst({
        where,
        select: { id: true, fullName: true, firstName: true, lastName: true, entityType: true },
      });
      if (match) {
        const name = `${match.firstName ?? ''} ${match.lastName ?? ''}`.trim() || match.fullName || '—';
        return { exists: true, field: 'name' as const, warnOnly: true, existingRecord: { id: match.id, fullName: name, type: 'customer' as const } };
      }
    }

    return { exists: false };
  }

  async bulkUpdateStatus(ids: string[], status: string) {
    await this.prisma.customer.updateMany({
      where: { id: { in: ids } },
      data: { status } as any,
    });
    return { updated: ids.length };
  }

  async bulkUpdateTags(ids: string[], tags: string[], action: 'add' | 'replace') {
    if (action === 'replace') {
      await this.prisma.customer.updateMany({
        where: { id: { in: ids } },
        data: { tags } as any,
      });
    } else {
      // add: merge existing tags with new ones
      const customers = await this.prisma.customer.findMany({
        where: { id: { in: ids } },
        select: { id: true, tags: true },
      });
      for (const c of customers) {
        const existing: string[] = (c.tags as string[]) ?? [];
        const merged = Array.from(new Set([...existing, ...tags]));
        await this.prisma.customer.update({
          where: { id: c.id },
          data: { tags: merged } as any,
        });
      }
    }
    return { updated: ids.length };
  }

  async exportToExcel(ids: string[]): Promise<Buffer> {
    const customers = await this.prisma.customer.findMany({
      where: ids.length ? { id: { in: ids } } : undefined,
      include: {
        _count: { select: { claimFiles: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Müşteriler');

    sheet.columns = [
      { header: 'Ad Soyad', key: 'fullName', width: 30 },
      { header: 'Telefon', key: 'phone', width: 18 },
      { header: 'E-posta', key: 'email', width: 28 },
      { header: 'Tip', key: 'tip', width: 14 },
      { header: 'Durum', key: 'durum', width: 14 },
      { header: 'Kaynak', key: 'kaynak', width: 22 },
      { header: 'Etiketler', key: 'etiketler', width: 30 },
      { header: 'Dosya Sayısı', key: 'dosyaSayisi', width: 14 },
    ];

    // Header styling
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 22;

    const statusLabel: Record<string, string> = {
      active: 'Aktif',
      passive: 'Pasif',
      blacklisted: 'Kara Liste',
    };
    const typeLabel: Record<string, string> = {
      individual: 'Bireysel',
      corporate: 'Kurumsal',
    };

    for (const c of customers) {
      const name =
        c.entityType === 'individual'
          ? `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || c.fullName || '—'
          : c.companyName || '—';
      sheet.addRow({
        fullName: name,
        phone: c.phone ?? '',
        email: c.email ?? '',
        tip: typeLabel[c.entityType ?? ''] ?? c.entityType ?? '',
        durum: statusLabel[(c as any).status ?? ''] ?? (c as any).status ?? '',
        kaynak: (c as any).source ?? '',
        etiketler: ((c as any).tags as string[] ?? []).join(', '),
        dosyaSayisi: c._count?.claimFiles ?? 0,
      });
    }

    // Alternate row shading
    sheet.eachRow((row, rowNum) => {
      if (rowNum > 1) {
        row.eachCell((cell) => {
          cell.alignment = { vertical: 'middle' };
          if (rowNum % 2 === 0) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F7FF' } };
          }
        });
      }
    });

    const buf = await workbook.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  /** Prisma Customer modelinde olmayan alanları ayıklar; privateServiceType → serviceType eşlemesi. */
  private sanitizeCustomerWriteData(rest: Record<string, unknown>): void {
    if (rest.privateServiceType && !rest.serviceType) {
      rest.serviceType = rest.privateServiceType;
    }
    delete rest.privateServiceType;
    delete rest.customerType;
  }

  private parseDate(value: any): string | null {
    if (!value || value === '') return null;
    // DD.MM.YYYY format
    if (typeof value === 'string' && /^\d{2}\.\d{2}\.\d{4}$/.test(value)) {
      const [day, month, year] = value.split('.');
      return new Date(`${year}-${month}-${day}T00:00:00.000Z`).toISOString();
    }
    // Already ISO or YYYY-MM-DD
    const d = new Date(value);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  }
}
