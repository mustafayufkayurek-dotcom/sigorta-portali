import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { toTitleCaseTR } from '@/common/utils/text-helpers';
import {
  CreateDepartmentDto,
  UpdateDepartmentDto,
  CreateFileSubjectDto,
  UpdateFileSubjectDto,
  UpsertFieldConfigDto,
} from './dto/departments.dto';

// Default field configs for each report format
const DEFAULT_FIELD_CONFIGS: Record<string, Array<{ fieldKey: string; fieldLabel: string; isRequired: boolean; isVisible: boolean; sortOrder: number }>> = {
  repair_single: [
    { fieldKey: 'reportDate', fieldLabel: 'Rapor Tarihi', isRequired: true, isVisible: true, sortOrder: 1 },
    { fieldKey: 'inspectorName', fieldLabel: 'Denetçi Adı', isRequired: false, isVisible: true, sortOrder: 2 },
    { fieldKey: 'reporterName', fieldLabel: 'Rapor Yazarı', isRequired: false, isVisible: true, sortOrder: 3 },
    { fieldKey: 'findingsText', fieldLabel: 'Bulgular', isRequired: false, isVisible: true, sortOrder: 4 },
    { fieldKey: 'legalNotes', fieldLabel: 'Hukuki Notlar', isRequired: false, isVisible: true, sortOrder: 5 },
    { fieldKey: 'buildingDamageTotal', fieldLabel: 'Bina Hasar Toplamı', isRequired: false, isVisible: true, sortOrder: 6 },
    { fieldKey: 'goodsDamageTotal', fieldLabel: 'Eşya Hasar Toplamı', isRequired: false, isVisible: true, sortOrder: 7 },
  ],
  repair_multi: [
    { fieldKey: 'reportDate', fieldLabel: 'Rapor Tarihi', isRequired: true, isVisible: true, sortOrder: 1 },
    { fieldKey: 'inspectorName', fieldLabel: 'Denetçi Adı', isRequired: false, isVisible: true, sortOrder: 2 },
    { fieldKey: 'reporterName', fieldLabel: 'Rapor Yazarı', isRequired: false, isVisible: true, sortOrder: 3 },
    { fieldKey: 'findingsText', fieldLabel: 'Bulgular', isRequired: false, isVisible: true, sortOrder: 4 },
    { fieldKey: 'legalNotes', fieldLabel: 'Hukuki Notlar', isRequired: false, isVisible: true, sortOrder: 5 },
    { fieldKey: 'buildingDamageTotal', fieldLabel: 'Bina Hasar Toplamı', isRequired: false, isVisible: true, sortOrder: 6 },
    { fieldKey: 'goodsDamageTotal', fieldLabel: 'Eşya Hasar Toplamı', isRequired: false, isVisible: true, sortOrder: 7 },
  ],
  emergency: [
    { fieldKey: 'reportDate', fieldLabel: 'Rapor Tarihi', isRequired: true, isVisible: true, sortOrder: 1 },
    { fieldKey: 'inspectorName', fieldLabel: 'Denetçi Adı', isRequired: false, isVisible: true, sortOrder: 2 },
    { fieldKey: 'reporterName', fieldLabel: 'Rapor Yazarı', isRequired: false, isVisible: true, sortOrder: 3 },
    { fieldKey: 'findingsText', fieldLabel: 'Bulgular', isRequired: false, isVisible: true, sortOrder: 4 },
  ],
};

/** Hasar onarım / sovtaj / özel müşteri / danışmanlık hatları için varsayılan hasar nedenleri */
const DEFAULT_REPAIR_FILE_SUBJECTS: Array<{ code: string; name: string; sortOrder: number }> = [
  { code: 'DAHILI_SU', name: 'Dahili Su', sortOrder: 1 },
  { code: 'YANGIN', name: 'Yangın', sortOrder: 2 },
  { code: 'DEPREM', name: 'Deprem', sortOrder: 3 },
  { code: 'SEL_SEYLAP', name: 'Sel-Seylap', sortOrder: 4 },
  { code: 'FIRTINA', name: 'Fırtına', sortOrder: 5 },
  { code: 'DOLU', name: 'Dolu', sortOrder: 6 },
  { code: 'HIRSIZLIK', name: 'Hırsızlık', sortOrder: 7 },
  { code: 'ARAC_CARPMA', name: 'Araç Çarpması', sortOrder: 8 },
];

@Injectable()
export class DepartmentsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    await this.mergeLegacyStajDepartment();
    return this.prisma.department.findMany({
      where: { status: 'active' },
      include: {
        _count: { select: { fileSubjects: true, claimFiles: true } },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /** Eski ensureKonuTabDepartments hatasıyla oluşan Staj kaydını Sovtaj ile birleştirir. */
  async mergeLegacyStajDepartment(): Promise<{ merged: boolean; message?: string }> {
    const legacy = await this.prisma.department.findFirst({
      where: {
        status: 'active',
        OR: [
          { code: { equals: 'staj', mode: 'insensitive' } },
          { name: { equals: 'Staj', mode: 'insensitive' } },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });
    if (!legacy) return { merged: false };

    let canonical = await this.prisma.department.findUnique({ where: { code: 'sovtaj' } });
    if (!canonical) {
      await this.prisma.department.update({
        where: { id: legacy.id },
        data: {
          code: 'sovtaj',
          name: 'Sovtaj',
          description: 'Sovtaj operasyon departmanı',
          color: '#10B981',
          sortOrder: 3,
          isSystem: true,
          status: 'active',
        },
      });
      return { merged: true, message: 'Staj departmanı Sovtaj olarak yeniden adlandırıldı' };
    }

    if (legacy.id === canonical.id) return { merged: false };

    const sovtajId = canonical.id;
    const stajId = legacy.id;
    const sovtajDescription = canonical.description ?? 'Sovtaj operasyon departmanı';
    const sovtajSortOrder = Math.min(canonical.sortOrder, 3);

    await this.prisma.$transaction(async (tx) => {
      await tx.claimFile.updateMany({ where: { departmentId: stajId }, data: { departmentId: sovtajId } });
      await tx.repairReport.updateMany({ where: { departmentId: stajId }, data: { departmentId: sovtajId } });
      await tx.hrEmployeeProfile.updateMany({ where: { departmentId: stajId }, data: { departmentId: sovtajId } });
      await tx.claimResponsibilityAssignment.updateMany({
        where: { departmentId: stajId },
        data: { departmentId: sovtajId },
      });

      const legacyMemberships = await tx.userDepartmentMembership.findMany({ where: { departmentId: stajId } });
      for (const membership of legacyMemberships) {
        const duplicate = await tx.userDepartmentMembership.findUnique({
          where: { userId_departmentId: { userId: membership.userId, departmentId: sovtajId } },
        });
        if (duplicate) {
          await tx.userDepartmentMembership.delete({ where: { id: membership.id } });
        } else {
          await tx.userDepartmentMembership.update({
            where: { id: membership.id },
            data: { departmentId: sovtajId },
          });
        }
      }

      const legacySubjects = await tx.departmentFileSubject.findMany({ where: { departmentId: stajId } });
      for (const subject of legacySubjects) {
        const duplicate = await tx.departmentFileSubject.findUnique({
          where: { departmentId_code: { departmentId: sovtajId, code: subject.code } },
        });
        if (duplicate) {
          await tx.departmentFileSubject.delete({ where: { id: subject.id } });
        } else {
          await tx.departmentFileSubject.update({
            where: { id: subject.id },
            data: { departmentId: sovtajId },
          });
        }
      }

      const legacyConfigs = await tx.reportFieldConfig.findMany({ where: { departmentId: stajId } });
      for (const config of legacyConfigs) {
        const duplicate = await tx.reportFieldConfig.findUnique({
          where: {
            departmentId_reportFormat_fieldKey: {
              departmentId: sovtajId,
              reportFormat: config.reportFormat,
              fieldKey: config.fieldKey,
            },
          },
        });
        if (duplicate) {
          await tx.reportFieldConfig.delete({ where: { id: config.id } });
        } else {
          await tx.reportFieldConfig.update({
            where: { id: config.id },
            data: { departmentId: sovtajId },
          });
        }
      }

      const allDocTypes = await tx.documentType.findMany();
      for (const docType of allDocTypes) {
        const raw = docType.departmentIds;
        const ids = Array.isArray(raw) ? (raw as string[]) : [];
        if (!ids.includes(stajId)) continue;
        const next = [...new Set(ids.map((id) => (id === stajId ? sovtajId : id)))];
        await tx.documentType.update({
          where: { id: docType.id },
          data: { departmentIds: next },
        });
      }

      await tx.department.update({
        where: { id: stajId },
        data: {
          status: 'inactive',
          code: `staj-legacy-${stajId.slice(0, 8)}`,
        },
      });

      await tx.department.update({
        where: { id: sovtajId },
        data: {
          name: 'Sovtaj',
          description: sovtajDescription,
          color: '#10B981',
          sortOrder: sovtajSortOrder,
          isSystem: true,
          status: 'active',
        },
      });
    });

    return { merged: true, message: 'Staj departmanı Sovtaj ile birleştirildi' };
  }

  async findOne(id: string) {
    const dept = await this.prisma.department.findUnique({
      where: { id },
      include: {
        fileSubjects: { orderBy: { sortOrder: 'asc' } },
        fieldConfigs: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!dept) throw new NotFoundException('Departman bulunamadı');
    return dept;
  }

  async create(dto: CreateDepartmentDto) {
    const existing = await this.prisma.department.findUnique({ where: { code: dto.code } });
    if (existing && existing.status.toLowerCase() !== 'active') {
      // Pasif kayıt var — geri yükle
      const restored = await this.prisma.department.update({
        where: { id: existing.id },
        data: { ...dto, status: 'active' },
      });
      return restored;
    }
    if (existing) throw new BadRequestException('Bu kod zaten aktif bir departmanda kullanılıyor');
    const nameConflict = await this.prisma.department.findFirst({ where: { name: dto.name, status: 'active' } });
    if (nameConflict) throw new ConflictException('Bu isimde aktif bir departman zaten mevcut');
    const dept = await this.prisma.department.create({ data: dto });

    // Seed default field configs for the report format
    const format = dto.reportFormat === 'emergency' ? 'emergency' : 'repair_single';
    const configs = DEFAULT_FIELD_CONFIGS[format] ?? DEFAULT_FIELD_CONFIGS['repair_single'];
    await this.prisma.reportFieldConfig.createMany({
      data: configs.map((c) => ({ ...c, departmentId: dept.id, reportFormat: format })),
      skipDuplicates: true,
    });

    return dept;
  }

  async update(id: string, dto: UpdateDepartmentDto) {
    await this.findOne(id);
    if (dto.name) {
      const conflict = await this.prisma.department.findFirst({ where: { name: dto.name, NOT: { id } } });
      if (conflict) throw new ConflictException('Bu isimde bir departman zaten mevcut');
    }
    return this.prisma.department.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const dept = await this.findOne(id);
    if (dept.isSystem) throw new BadRequestException('Sistem departmanları silinemez');
    try {
      await this.prisma.department.update({
        where: { id },
        data: { status: 'inactive' },
      });
      return { success: true, message: 'Departman pasifleştirildi' };
    } catch (error) {
      throw new BadRequestException(
        'Departman pasifleştirilemedi. Bu departmana bağlı aktif kayıtlar olabilir.',
      );
    }
  }

  // ─── File Subjects ────────────────────────────────────────────────────────

  async getFileSubjects(departmentId: string) {
    const dept = await this.findOne(departmentId);
    if (dept.reportFormat === 'repair') {
      await this.ensureDefaultRepairFileSubjects(departmentId);
    }
    return this.prisma.departmentFileSubject.findMany({
      where: { departmentId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async createFileSubject(departmentId: string, dto: CreateFileSubjectDto) {
    await this.findOne(departmentId);
    const name = toTitleCaseTR(dto.name.trim());
    if (!name) throw new BadRequestException('Konu adı zorunludur');
    const existing = await this.prisma.departmentFileSubject.findUnique({
      where: { departmentId_code: { departmentId, code: dto.code } },
    });
    if (existing) throw new BadRequestException('Bu kod zaten kullanımda');
    const nameConflict = await this.prisma.departmentFileSubject.findFirst({
      where: { departmentId, name },
    });
    if (nameConflict) throw new ConflictException('Bu isimde bir dosya konusu zaten mevcut');
    return this.prisma.departmentFileSubject.create({ data: { ...dto, name, departmentId } });
  }

  async updateFileSubject(id: string, dto: UpdateFileSubjectDto) {
    const subject = await this.prisma.departmentFileSubject.findUnique({ where: { id } });
    if (!subject) throw new NotFoundException('Dosya konusu bulunamadı');
    const nextName = dto.name !== undefined ? toTitleCaseTR(dto.name.trim()) : undefined;
    if (nextName !== undefined && !nextName) {
      throw new BadRequestException('Konu adı zorunludur');
    }
    if (dto.code && dto.code !== subject.code) {
      const conflict = await this.prisma.departmentFileSubject.findUnique({
        where: { departmentId_code: { departmentId: subject.departmentId, code: dto.code } },
      });
      if (conflict) throw new BadRequestException('Bu kod zaten kullanımda');
    }
    if (nextName && nextName !== subject.name) {
      const nameConflict = await this.prisma.departmentFileSubject.findFirst({
        where: { departmentId: subject.departmentId, name: nextName, NOT: { id } },
      });
      if (nameConflict) throw new ConflictException('Bu isimde bir dosya konusu zaten mevcut');
    }
    return this.prisma.departmentFileSubject.update({
      where: { id },
      data: {
        ...dto,
        ...(nextName !== undefined ? { name: nextName } : {}),
      },
    });
  }

  async removeFileSubject(id: string) {
    const subject = await this.prisma.departmentFileSubject.findUnique({ where: { id } });
    if (!subject) throw new NotFoundException('Dosya konusu bulunamadı');
    if (subject.isSystem) throw new BadRequestException('Sistem dosya konuları silinemez');
    await this.prisma.departmentFileSubject.delete({ where: { id } });
    return { success: true };
  }

  // ─── Field Configs ────────────────────────────────────────────────────────

  async getFieldConfigs(departmentId: string, reportFormat?: string) {
    await this.findOne(departmentId);
    const where: any = { departmentId };
    if (reportFormat) where.reportFormat = reportFormat;
    return this.prisma.reportFieldConfig.findMany({ where, orderBy: { sortOrder: 'asc' } });
  }

  async upsertFieldConfigs(departmentId: string, configs: UpsertFieldConfigDto[]) {
    await this.findOne(departmentId);
    const results = await Promise.all(
      configs.map((cfg) =>
        this.prisma.reportFieldConfig.upsert({
          where: {
            departmentId_reportFormat_fieldKey: {
              departmentId,
              reportFormat: cfg.reportFormat,
              fieldKey: cfg.fieldKey,
            },
          },
          create: { ...cfg, departmentId },
          update: {
            fieldLabel: cfg.fieldLabel,
            isRequired: cfg.isRequired,
            isVisible: cfg.isVisible,
            sortOrder: cfg.sortOrder,
          },
        }),
      ),
    );
    return results;
  }

  /** Operasyon hattında aktif dosya konusu yoksa varsayılan hasar nedenlerini ekler. */
  private async ensureDefaultRepairFileSubjects(departmentId: string) {
    const activeCount = await this.prisma.departmentFileSubject.count({
      where: { departmentId, status: 'active' },
    });
    if (activeCount > 0) return;

    for (const subject of DEFAULT_REPAIR_FILE_SUBJECTS) {
      await this.prisma.departmentFileSubject.upsert({
        where: { departmentId_code: { departmentId, code: subject.code } },
        create: {
          ...subject,
          departmentId,
          isSystem: true,
          status: 'active',
        },
        update: { status: 'active', name: subject.name, sortOrder: subject.sortOrder },
      });
    }
  }

  // ─── Seed ─────────────────────────────────────────────────────────────────

  async seedSystemData() {
    // Create Hasar Onarım department
    const hasarOnarim = await this.prisma.department.upsert({
      where: { code: 'hasar-onarim' },
      create: {
        code: 'hasar-onarim',
        name: 'Hasar Onarım',
        description: 'Hasar onarım dosyaları ve raporları',
        color: '#3B82F6',
        reportFormat: 'repair',
        sortOrder: 1,
        isSystem: true,
      },
      update: {},
    });

    // Create Acil Yardım department
    const acilYardim = await this.prisma.department.upsert({
      where: { code: 'acil-yardim' },
      create: {
        code: 'acil-yardim',
        name: 'Acil Yardım',
        description: 'Acil müdahale ve yardım hizmetleri',
        color: '#EF4444',
        reportFormat: 'emergency',
        sortOrder: 2,
        isSystem: true,
      },
      update: {},
    });

    for (const s of DEFAULT_REPAIR_FILE_SUBJECTS) {
      await this.prisma.departmentFileSubject.upsert({
        where: { departmentId_code: { departmentId: hasarOnarim.id, code: s.code } },
        create: { ...s, departmentId: hasarOnarim.id, isSystem: true, status: 'active' },
        update: { status: 'active' },
      });
    }

    // Seed default field configs
    for (const [format, configs] of Object.entries(DEFAULT_FIELD_CONFIGS)) {
      const deptId = format === 'emergency' ? acilYardim.id : hasarOnarim.id;
      for (const cfg of configs) {
        await this.prisma.reportFieldConfig.upsert({
          where: {
            departmentId_reportFormat_fieldKey: {
              departmentId: deptId,
              reportFormat: format,
              fieldKey: cfg.fieldKey,
            },
          },
          create: { ...cfg, departmentId: deptId, reportFormat: format },
          update: {},
        });
      }
    }

    return { hasarOnarim, acilYardim };
  }

  /** Dosya Konuları sekmeleri ve rapor sihirbazı için operasyon hatları */
  async ensureKonuTabDepartments() {
    await this.mergeLegacyStajDepartment();

    const extras = [
      {
        code: 'hasar-onarim',
        name: 'Hasar Onarım',
        description: 'Hasar onarım dosyaları ve raporları',
        color: '#3B82F6',
        reportFormat: 'repair',
        sortOrder: 1,
      },
      {
        code: 'acil-yardim',
        name: 'Acil Yardım',
        description: 'Acil müdahale ve yardım hizmetleri',
        color: '#EF4444',
        reportFormat: 'emergency',
        sortOrder: 2,
      },
      {
        code: 'sovtaj',
        name: 'Sovtaj',
        description: 'Sovtaj operasyon departmanı',
        color: '#10B981',
        reportFormat: 'repair',
        sortOrder: 3,
      },
      {
        code: 'ozel-musteri',
        name: 'Özel Müşteri',
        description: 'Özel müşteri dosya konuları',
        color: '#10B981',
        reportFormat: 'repair',
        sortOrder: 4,
      },
      {
        code: 'danismanlik',
        name: 'Danışmanlık',
        description: 'Danışmanlık hizmet dosya konuları',
        color: '#8B5CF6',
        reportFormat: 'repair',
        sortOrder: 5,
      },
    ];

    const created = [];
    for (const dept of extras) {
      const byName = await this.prisma.department.findFirst({
        where: { name: dept.name, status: 'active' },
      });
      if (byName && byName.code !== dept.code) {
        if (dept.reportFormat === 'repair') {
          await this.ensureDefaultRepairFileSubjects(byName.id);
        }
        created.push(byName);
        continue;
      }
      const row = await this.prisma.department.upsert({
        where: { code: dept.code },
        create: { ...dept, isSystem: true, status: 'active' },
        update: {
          name: dept.name,
          description: dept.description,
          color: dept.color,
          reportFormat: dept.reportFormat,
          sortOrder: dept.sortOrder,
          status: 'active',
        },
      });
      if (dept.reportFormat === 'repair') {
        await this.ensureDefaultRepairFileSubjects(row.id);
      }
      created.push(row);
    }
    return created;
  }
}
