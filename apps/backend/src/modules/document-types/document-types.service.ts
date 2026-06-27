import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateDocumentTypeDto, UpdateDocumentTypeDto } from './dto/document-types.dto';

function parseIdList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === 'string' && item.length > 0);
}

function matchesDepartment(documentType: { departmentIds: unknown }, departmentId?: string): boolean {
  const ids = parseIdList(documentType.departmentIds);
  if (!departmentId) return true;
  if (ids.length === 0) return true;
  return ids.includes(departmentId);
}

@Injectable()
export class DocumentTypesService {
  constructor(private prisma: PrismaService) {}

  async findAll(params?: { status?: string; departmentId?: string }) {
    const where: any = {};
    if (params?.status) where.status = params.status;

    const rows = await this.prisma.documentType.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        _count: { select: { vendorDocuments: true } },
      },
    });

    const data = params?.departmentId
      ? rows.filter((row) => matchesDepartment(row, params.departmentId))
      : rows;

    return { data };
  }

  async findOne(id: string) {
    const documentType = await this.prisma.documentType.findUnique({
      where: { id },
      include: {
        _count: { select: { vendorDocuments: true } },
      },
    });

    if (!documentType) {
      throw new NotFoundException('Evrak türü bulunamadı');
    }

    return documentType;
  }

  async create(dto: CreateDocumentTypeDto) {
    const departmentIds = parseIdList(dto.departmentIds);
    if (departmentIds.length === 0) {
      throw new BadRequestException('En az bir departman seçilmelidir');
    }

    const existing = await this.prisma.documentType.findUnique({
      where: { code: dto.code },
    });

    if (existing) {
      throw new ConflictException('Bu kod ile bir evrak türü zaten mevcut');
    }

    const nameConflict = await this.prisma.documentType.findFirst({
      where: { name: dto.name },
    });
    if (nameConflict) {
      const conflictDepartments = parseIdList(nameConflict.departmentIds);
      const overlaps = departmentIds.some((id) => conflictDepartments.includes(id));
      if (overlaps || conflictDepartments.length === 0) {
        throw new ConflictException('Bu departmanda aynı isimde bir evrak türü zaten mevcut');
      }
    }

    return this.prisma.documentType.create({
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description,
        isRequired: dto.isRequired ?? false,
        sortOrder: dto.sortOrder ?? 0,
        departmentIds,
        serviceTypeIds: dto.serviceTypeIds ?? [],
      },
    });
  }

  async update(id: string, dto: UpdateDocumentTypeDto) {
    const current = await this.findOne(id);

    if (dto.code) {
      const existing = await this.prisma.documentType.findFirst({
        where: { code: dto.code, NOT: { id } },
      });
      if (existing) {
        throw new ConflictException('Bu kod ile başka bir evrak türü zaten mevcut');
      }
    }

    if (dto.name) {
      const nextDepartments = dto.departmentIds !== undefined
        ? parseIdList(dto.departmentIds)
        : parseIdList(current.departmentIds);
      const nameConflict = await this.prisma.documentType.findFirst({
        where: { name: dto.name, NOT: { id } },
      });
      if (nameConflict) {
        const conflictDepartments = parseIdList(nameConflict.departmentIds);
        const overlaps = nextDepartments.some((deptId) => conflictDepartments.includes(deptId));
        if (overlaps || conflictDepartments.length === 0) {
          throw new ConflictException('Bu departmanda aynı isimde başka bir evrak türü zaten mevcut');
        }
      }
    }

    const data: UpdateDocumentTypeDto = { ...dto };
    if (dto.departmentIds !== undefined) {
      const departmentIds = parseIdList(dto.departmentIds);
      if (departmentIds.length === 0) {
        throw new BadRequestException('En az bir departman seçilmelidir');
      }
      data.departmentIds = departmentIds;
    }

    return this.prisma.documentType.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    const docCount = await this.prisma.vendorDocument.count({
      where: { documentTypeId: id },
    });

    if (docCount > 0) {
      throw new ConflictException(
        `Bu evrak türüne bağlı ${docCount} evrak mevcut. Önce evrakları silmelisiniz.`,
      );
    }

    await this.prisma.documentType.delete({ where: { id } });
    return { message: 'Evrak türü silindi' };
  }
}
