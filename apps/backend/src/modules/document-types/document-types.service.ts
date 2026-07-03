import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateDocumentTypeDto, UpdateDocumentTypeDto } from './dto/document-types.dto';
import {
  DocumentEntityScope,
  deriveServiceBranchTypes,
  matchesCustomerSubType,
  matchesEntityScope,
  matchesServiceBranchType,
  parseServiceBranchTypes,
  parseStringList,
  scopesOverlap,
  sortCompareTR,
  ServiceBranchTypeKey,
} from './document-type-scope';

function matchesDepartment(documentType: { departmentIds: unknown }, departmentId?: string): boolean {
  const ids = parseStringList(documentType.departmentIds);
  if (!departmentId) return true;
  if (ids.length === 0) return true;
  return ids.includes(departmentId);
}

@Injectable()
export class DocumentTypesService {
  constructor(private prisma: PrismaService) {}

  private async buildDeptCodeMap(): Promise<Map<string, string>> {
    const rows = await this.prisma.department.findMany({ select: { id: true, code: true } });
    return new Map(rows.map((r) => [r.id, r.code]));
  }

  private async nextSortOrder(): Promise<number> {
    const agg = await this.prisma.documentType.aggregate({ _max: { sortOrder: true } });
    return (agg._max.sortOrder ?? 0) + 10;
  }

  private validateScopePayload(dto: {
    entityScope?: string;
    serviceBranchTypes?: string[];
    customerSubTypes?: string[];
  }) {
    const scope = (dto.entityScope ?? 'vendor') as DocumentEntityScope;
    const branchTypes = parseServiceBranchTypes(dto.serviceBranchTypes);
    const subTypes = parseStringList(dto.customerSubTypes);

    if (scope === 'vendor' && branchTypes.length === 0) {
      throw new BadRequestException('Tedarikçi evrakları için en az bir Meridyen hizmet türü seçilmelidir');
    }
    if (scope === 'customer' && subTypes.length === 0) {
      throw new BadRequestException('Müşteri evrakları için en az bir müşteri tipi seçilmelidir');
    }
  }

  private async assertNameUnique(
    name: string,
    excludeId: string | null,
    scope: DocumentEntityScope,
    serviceBranchTypes: string[],
    customerSubTypes: string[],
    deptCodeById: Map<string, string>,
  ) {
    const candidates = await this.prisma.documentType.findMany({
      where: {
        name,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });
    const conflict = candidates.find((row) =>
      scopesOverlap(
        {
          entityScope: scope,
          serviceBranchTypes,
          customerSubTypes,
        },
        {
          entityScope: (row.entityScope ?? 'vendor') as DocumentEntityScope,
          serviceBranchTypes: row.serviceBranchTypes,
          customerSubTypes: row.customerSubTypes,
          departmentIds: row.departmentIds,
        },
        deptCodeById,
      ),
    );
    if (conflict) {
      throw new ConflictException('Bu kapsamda aynı isimde bir evrak türü zaten mevcut');
    }
  }

  async findAll(params?: {
    status?: string;
    departmentId?: string;
    entityScope?: DocumentEntityScope;
    serviceBranchType?: ServiceBranchTypeKey;
    customerSubType?: string;
  }) {
    const where: Record<string, unknown> = {};
    if (params?.status) where.status = params.status;
    if (params?.entityScope) where.entityScope = params.entityScope;

    const deptCodeById = await this.buildDeptCodeMap();

    const rows = await this.prisma.documentType.findMany({
      where,
      include: {
        _count: { select: { vendorDocuments: true, entityDocuments: true } },
      },
    });

    let data = rows.filter((row) => matchesDepartment(row, params?.departmentId));
    data = data.filter((row) => matchesEntityScope(row, params?.entityScope));
    data = data.filter((row) =>
      matchesServiceBranchType(row, params?.serviceBranchType, deptCodeById),
    );
    data = data.filter((row) => matchesCustomerSubType(row, params?.customerSubType));

    data.sort((a, b) => sortCompareTR(a.name, b.name));

    return { data };
  }

  async findOne(id: string) {
    const documentType = await this.prisma.documentType.findUnique({
      where: { id },
      include: {
        _count: { select: { vendorDocuments: true, entityDocuments: true } },
      },
    });

    if (!documentType) {
      throw new NotFoundException('Evrak türü bulunamadı');
    }

    return documentType;
  }

  async create(dto: CreateDocumentTypeDto) {
    const entityScope = (dto.entityScope ?? 'vendor') as DocumentEntityScope;
    const serviceBranchTypes = parseServiceBranchTypes(dto.serviceBranchTypes);
    const customerSubTypes = parseStringList(dto.customerSubTypes);
    this.validateScopePayload({ entityScope, serviceBranchTypes, customerSubTypes });

    const existing = await this.prisma.documentType.findUnique({
      where: { code: dto.code },
    });

    if (existing) {
      throw new ConflictException('Bu kod ile bir evrak türü zaten mevcut');
    }

    const deptCodeById = await this.buildDeptCodeMap();
    await this.assertNameUnique(
      dto.name,
      null,
      entityScope,
      serviceBranchTypes,
      customerSubTypes,
      deptCodeById,
    );

    const departmentIds = parseStringList(dto.departmentIds);

    return this.prisma.documentType.create({
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description,
        isRequired: dto.isRequired ?? false,
        sortOrder: dto.sortOrder ?? (await this.nextSortOrder()),
        departmentIds,
        serviceTypeIds: dto.serviceTypeIds ?? [],
        serviceBranchTypes,
        customerSubTypes,
        entityScope,
      },
    });
  }

  async update(id: string, dto: UpdateDocumentTypeDto) {
    const current = await this.findOne(id);
    const deptCodeById = await this.buildDeptCodeMap();

    if (dto.code) {
      const existing = await this.prisma.documentType.findFirst({
        where: { code: dto.code, NOT: { id } },
      });
      if (existing) {
        throw new ConflictException('Bu kod ile başka bir evrak türü zaten mevcut');
      }
    }

    const nextScope = (dto.entityScope ?? current.entityScope ?? 'vendor') as DocumentEntityScope;
    const nextBranchTypes =
      dto.serviceBranchTypes !== undefined
        ? parseServiceBranchTypes(dto.serviceBranchTypes)
        : deriveServiceBranchTypes(current.serviceBranchTypes, current.departmentIds, deptCodeById);
    const nextSubTypes =
      dto.customerSubTypes !== undefined
        ? parseStringList(dto.customerSubTypes)
        : parseStringList(current.customerSubTypes);

    this.validateScopePayload({
      entityScope: nextScope,
      serviceBranchTypes: nextBranchTypes,
      customerSubTypes: nextSubTypes,
    });

    if (dto.name) {
      await this.assertNameUnique(
        dto.name,
        id,
        nextScope,
        nextBranchTypes,
        nextSubTypes,
        deptCodeById,
      );
    }

    const data: {
      code?: string;
      name?: string;
      description?: string | null;
      isRequired?: boolean;
      sortOrder?: number;
      status?: string;
      departmentIds?: string[];
      serviceTypeIds?: string[];
      serviceBranchTypes?: string[];
      customerSubTypes?: string[];
      entityScope?: string;
    } = {};

    if (dto.code !== undefined) data.code = dto.code;
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.isRequired !== undefined) data.isRequired = dto.isRequired;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.departmentIds !== undefined) data.departmentIds = parseStringList(dto.departmentIds);
    if (dto.serviceTypeIds !== undefined) data.serviceTypeIds = dto.serviceTypeIds;
    if (dto.serviceBranchTypes !== undefined) {
      data.serviceBranchTypes = nextBranchTypes;
      data.departmentIds = [];
    }
    if (dto.customerSubTypes !== undefined) data.customerSubTypes = nextSubTypes;
    if (dto.entityScope !== undefined) data.entityScope = nextScope;

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
