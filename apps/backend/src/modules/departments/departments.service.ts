import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
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

@Injectable()
export class DepartmentsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.department.findMany({
      include: {
        _count: { select: { fileSubjects: true, claimFiles: true } },
      },
      orderBy: { sortOrder: 'asc' },
    });
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
    if (existing) throw new BadRequestException('Bu kod zaten kullanımda');
    const nameConflict = await this.prisma.department.findFirst({ where: { name: dto.name } });
    if (nameConflict) throw new ConflictException('Bu isimde bir departman zaten mevcut');
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
    await this.prisma.department.delete({ where: { id } });
    return { success: true };
  }

  // ─── File Subjects ────────────────────────────────────────────────────────

  async getFileSubjects(departmentId: string) {
    await this.findOne(departmentId);
    return this.prisma.departmentFileSubject.findMany({
      where: { departmentId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async createFileSubject(departmentId: string, dto: CreateFileSubjectDto) {
    await this.findOne(departmentId);
    const existing = await this.prisma.departmentFileSubject.findUnique({
      where: { departmentId_code: { departmentId, code: dto.code } },
    });
    if (existing) throw new BadRequestException('Bu kod zaten kullanımda');
    const nameConflict = await this.prisma.departmentFileSubject.findFirst({
      where: { departmentId, name: dto.name },
    });
    if (nameConflict) throw new ConflictException('Bu isimde bir dosya konusu zaten mevcut');
    return this.prisma.departmentFileSubject.create({ data: { ...dto, departmentId } });
  }

  async updateFileSubject(id: string, dto: UpdateFileSubjectDto) {
    const subject = await this.prisma.departmentFileSubject.findUnique({ where: { id } });
    if (!subject) throw new NotFoundException('Dosya konusu bulunamadı');
    if (dto.code && dto.code !== subject.code) {
      const conflict = await this.prisma.departmentFileSubject.findUnique({
        where: { departmentId_code: { departmentId: subject.departmentId, code: dto.code } },
      });
      if (conflict) throw new BadRequestException('Bu kod zaten kullanımda');
    }
    if (dto.name && dto.name !== subject.name) {
      const nameConflict = await this.prisma.departmentFileSubject.findFirst({
        where: { departmentId: subject.departmentId, name: dto.name, NOT: { id } },
      });
      if (nameConflict) throw new ConflictException('Bu isimde bir dosya konusu zaten mevcut');
    }
    return this.prisma.departmentFileSubject.update({ where: { id }, data: dto });
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

  // ─── Seed ─────────────────────────────────────────────────────────────────

  async seedSystemData() {
    // Create Hasar Onarım department
    const hasarOnarim = await this.prisma.department.upsert({
      where: { code: 'HASAR_ONARIM' },
      create: {
        code: 'HASAR_ONARIM',
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
      where: { code: 'ACIL_YARDIM' },
      create: {
        code: 'ACIL_YARDIM',
        name: 'Acil Yardım',
        description: 'Acil müdahale ve yardım hizmetleri',
        color: '#EF4444',
        reportFormat: 'emergency',
        sortOrder: 2,
        isSystem: true,
      },
      update: {},
    });

    // Seed file subjects for Hasar Onarım
    const hasarSubjects = [
      { code: 'DAHILI_SU', name: 'Dahili Su', sortOrder: 1 },
      { code: 'YANGIN', name: 'Yangın', sortOrder: 2 },
      { code: 'DEPREM', name: 'Deprem', sortOrder: 3 },
      { code: 'SEL_SEYLAP', name: 'Sel-Seylap', sortOrder: 4 },
      { code: 'FIRTINA', name: 'Fırtına', sortOrder: 5 },
      { code: 'DOLU', name: 'Dolu', sortOrder: 6 },
      { code: 'HIRSIZLIK', name: 'Hırsızlık', sortOrder: 7 },
      { code: 'ARAC_CARPMA', name: 'Araç Çarpması', sortOrder: 8 },
    ];

    for (const s of hasarSubjects) {
      await this.prisma.departmentFileSubject.upsert({
        where: { departmentId_code: { departmentId: hasarOnarim.id, code: s.code } },
        create: { ...s, departmentId: hasarOnarim.id, isSystem: true },
        update: {},
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
}
