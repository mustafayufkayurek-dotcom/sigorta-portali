import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { hasarResponsibilityCoversSubject } from '@sigorta/shared';
import { regionValueMatchesProvince } from '@/common/helpers/turkey-geographic-regions.helper';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateClaimResponsibilityDto, UpdateClaimResponsibilityDto } from './dto/claim-responsibilities.dto';

@Injectable()
export class ClaimResponsibilitiesService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters?: { userId?: string; departmentId?: string; isActive?: boolean }) {
    const where: any = {};
    if (filters?.userId) where.userId = filters.userId;
    if (filters?.departmentId) where.departmentId = filters.departmentId;
    if (filters?.isActive !== undefined) where.isActive = filters.isActive;

    return this.prisma.claimResponsibilityAssignment.findMany({
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        department: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async findOne(id: string) {
    const assignment = await this.prisma.claimResponsibilityAssignment.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        department: { select: { id: true, code: true, name: true } },
      },
    });
    if (!assignment) throw new NotFoundException('Dosya sorumluluğu bulunamadı');
    return assignment;
  }

  async create(dto: CreateClaimResponsibilityDto) {
    // Validate user and department
    const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!user) throw new BadRequestException('Kullanıcı bulunamadı');

    const department = await this.prisma.department.findUnique({ where: { id: dto.departmentId } });
    if (!department) throw new BadRequestException('Departman bulunamadı');

    // Validate regionValues for countrywide
    if (dto.regionType === 'countrywide' && dto.regionValues.length > 0) {
      throw new BadRequestException('Countrywide kapsamında bölge belirtilmemelidir');
    }

    return this.prisma.claimResponsibilityAssignment.create({
      data: {
        userId: dto.userId,
        departmentId: dto.departmentId,
        regionType: dto.regionType,
        regionValues: dto.regionValues,
        coverageType: dto.coverageType ?? 'all',
        coverageConfig: dto.coverageConfig ?? {},
        priority: dto.priority ?? 0,
        isActive: dto.isActive ?? true,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        department: { select: { id: true, code: true, name: true } },
      },
    });
  }

  async update(id: string, dto: UpdateClaimResponsibilityDto) {
    await this.findOne(id);

    if (dto.regionType === 'countrywide' && dto.regionValues && dto.regionValues.length > 0) {
      throw new BadRequestException('Countrywide kapsamında bölge belirtilmemelidir');
    }

    return this.prisma.claimResponsibilityAssignment.update({
      where: { id },
      data: dto,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        department: { select: { id: true, code: true, name: true } },
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.claimResponsibilityAssignment.delete({ where: { id } });
    return { success: true };
  }

  /**
   * Dosya sorumlusu routing logic:
   * Verilen departman, city, district ve claimSubjectId'ye göre uygun sorumluyu döner.
   * Priority sırasına göre seçim yapar.
   */
  async findResponsibleUser(params: {
    departmentId: string;
    city: string;
    district?: string;
    claimSubjectId?: string;
    claimSubjectName?: string;
  }) {
    const matches = await this.findMatchingResponsibleUsers(params);
    return matches[0] ?? null;
  }

  /** Bölge Hasar izi: eşleşen bütün kişiler. Konu istisnası kapsam dışını keser. */
  async findMatchingResponsibleUsers(params: {
    departmentId: string;
    city: string;
    district?: string;
    claimSubjectId?: string;
    claimSubjectName?: string;
  }) {
    const { departmentId, city, district, claimSubjectId, claimSubjectName } = params;

    const assignments = await this.prisma.claimResponsibilityAssignment.findMany({
      where: {
        departmentId,
        isActive: true,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });

    const matched: Array<{ id: string; firstName: string | null; lastName: string | null; email: string | null }> = [];
    const seen = new Set<string>();

    for (const a of assignments) {
      if (!a.user?.id || seen.has(a.user.id)) continue;
      const cfg = (a.coverageConfig ?? {}) as { claimSubjectIds?: unknown; ihbarSubjects?: unknown };
      if (!hasarResponsibilityCoversSubject({
        coverageType: a.coverageType,
        coverageConfig: cfg,
        claimSubjectId,
        claimSubjectName,
      })) {
        continue;
      }

      let regionOk = false;
      if (a.regionType === 'countrywide') regionOk = true;
      const regionValues = (a.regionValues as string[]) ?? [];
      if (a.regionType === 'city' && regionValues.includes(city)) regionOk = true;
      if (a.regionType === 'district' && district && regionValues.includes(district)) regionOk = true;
      if (a.regionType === 'region' && regionValueMatchesProvince(regionValues, city)) regionOk = true;
      if (!regionOk) continue;

      seen.add(a.user.id);
      matched.push(a.user);
    }

    return matched;
  }
}
