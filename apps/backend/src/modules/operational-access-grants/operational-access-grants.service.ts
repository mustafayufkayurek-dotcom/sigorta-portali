import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import {
  CreateOperationalAccessGrantDto,
  OperationalGrantType,
  OperationalScopeType,
} from './dto/operational-access-grants.dto';

const USER_SELECT = { id: true, firstName: true, lastName: true, email: true };

export type DelegationBanner = {
  actingUser: { id: string; firstName: string; lastName: string };
  principalUser: { id: string; firstName: string; lastName: string } | null;
  reason: string | null;
  validUntil: string | null;
};

export type OperationalAccessGrantSummary = {
  id: string;
  scopeType: string;
  grantType: string;
  accessLevel: string;
  validFrom: string;
  validTo: string | null;
  principalUserId: string | null;
};

@Injectable()
export class OperationalAccessGrantsService {
  constructor(private readonly prisma: PrismaService) {}

  private activeGrantWhere(now = new Date()) {
    return {
      isActive: true,
      validFrom: { lte: now },
      OR: [{ validTo: null }, { validTo: { gte: now } }],
    };
  }

  private scopeMatches(scopeType: string, requested?: OperationalScopeType): boolean {
    if (!requested) return true;
    if (scopeType === 'both') return true;
    if (requested === 'both') return scopeType === 'hasar' || scopeType === 'acil_yardim';
    return scopeType === requested || scopeType === 'both';
  }

  async getActiveGrantsForGrantee(userId: string) {
    return this.prisma.operationalAccessGrant.findMany({
      where: { granteeUserId: userId, ...this.activeGrantWhere() },
      include: {
        principalUser: { select: USER_SELECT },
        grantedByUser: { select: USER_SELECT },
      },
      orderBy: [{ validFrom: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async getPrincipalUserIdsForGrantee(
    userId: string,
    scopeType?: OperationalScopeType,
  ): Promise<string[]> {
    const grants = await this.prisma.operationalAccessGrant.findMany({
      where: {
        granteeUserId: userId,
        grantType: 'person_delegation',
        principalUserId: { not: null },
        ...this.activeGrantWhere(),
      },
      select: { principalUserId: true, scopeType: true },
    });

    const ids = grants
      .filter((g) => g.principalUserId && this.scopeMatches(g.scopeType, scopeType))
      .map((g) => g.principalUserId as string);

    return [...new Set(ids)];
  }

  async hasFunctionDelegation(userId: string, scopeType: OperationalScopeType): Promise<boolean> {
    const grants = await this.prisma.operationalAccessGrant.findMany({
      where: {
        granteeUserId: userId,
        grantType: 'function_delegation',
        ...this.activeGrantWhere(),
      },
      select: { scopeType: true },
    });
    return grants.some((g) => this.scopeMatches(g.scopeType, scopeType));
  }

  async resolveDelegationBanner(
    viewingUserId: string,
    assignedUserId: string | null | undefined,
    scopeType: OperationalScopeType,
  ): Promise<DelegationBanner | null> {
    if (!assignedUserId || viewingUserId === assignedUserId) return null;

    const grant = await this.prisma.operationalAccessGrant.findFirst({
      where: {
        granteeUserId: viewingUserId,
        grantType: 'person_delegation',
        principalUserId: assignedUserId,
        ...this.activeGrantWhere(),
      },
      include: {
        granteeUser: { select: USER_SELECT },
        principalUser: { select: USER_SELECT },
      },
      orderBy: { validFrom: 'desc' },
    });

    if (!grant || !this.scopeMatches(grant.scopeType, scopeType)) return null;

    return {
      actingUser: grant.granteeUser,
      principalUser: grant.principalUser,
      reason: grant.reason,
      validUntil: grant.validTo ? grant.validTo.toISOString() : null,
    };
  }

  async buildClaimFileDelegationScope(userId: string, roleCode: string) {
    if (!this.isDelegationScopedRole(roleCode)) return {};
    const principalIds = await this.getPrincipalUserIdsForGrantee(userId, 'hasar');
    const assigneeIds = [userId, ...principalIds];
    return {
      OR: [
        { assignedOfficeUserId: { in: assigneeIds } },
        {
          assignedOfficeUserId: null,
          statusHistory: {
            some: {
              changedByUserId: userId,
              note: 'Dosya oluşturuldu',
            },
          },
        },
      ],
    };
  }

  async buildEmergencyDelegationScope(userId: string, roleCode: string) {
    if (!this.isDelegationScopedRole(roleCode)) return {};
    const principalIds = await this.getPrincipalUserIdsForGrantee(userId, 'acil_yardim');
    return {
      OR: [
        { assignedUserId: { in: [userId, ...principalIds] } },
        { assignedUserId: null, createdByUserId: userId },
      ],
    };
  }

  async canAccessAssignedUserViaDelegation(
    viewingUserId: string,
    assignedUserId: string | null | undefined,
    scopeType: OperationalScopeType,
  ): Promise<boolean> {
    if (!assignedUserId || viewingUserId === assignedUserId) return false;
    const principalIds = await this.getPrincipalUserIdsForGrantee(viewingUserId, scopeType);
    return principalIds.includes(assignedUserId);
  }

  isDelegationScopedRole(roleCode: string): boolean {
    const code = String(roleCode ?? '').trim().toLowerCase();
    return code === 'office_staff' || code === 'finance' || code === 'finans' || code === 'accountant';
  }

  async getGrantSummaryForUser(userId: string): Promise<OperationalAccessGrantSummary[]> {
    const grants = await this.getActiveGrantsForGrantee(userId);
    return grants.map((g) => ({
      id: g.id,
      scopeType: g.scopeType,
      grantType: g.grantType,
      accessLevel: g.accessLevel,
      validFrom: g.validFrom.toISOString(),
      validTo: g.validTo ? g.validTo.toISOString() : null,
      principalUserId: g.principalUserId,
    }));
  }

  async listByGrantee(granteeUserId: string) {
    return this.prisma.operationalAccessGrant.findMany({
      where: { granteeUserId },
      include: {
        principalUser: { select: USER_SELECT },
        grantedByUser: { select: USER_SELECT },
      },
      orderBy: [{ isActive: 'desc' }, { validFrom: 'desc' }],
    });
  }

  async listActiveFunctionDelegates(scopeType: OperationalScopeType) {
    const grants = await this.prisma.operationalAccessGrant.findMany({
      where: {
        grantType: 'function_delegation',
        ...this.activeGrantWhere(),
      },
      include: {
        granteeUser: { select: USER_SELECT },
      },
      orderBy: { validFrom: 'desc' },
    });

    const seen = new Set<string>();
    const users: Array<{ id: string; firstName: string; lastName: string; email: string }> = [];
    for (const grant of grants) {
      if (!this.scopeMatches(grant.scopeType, scopeType)) continue;
      if (seen.has(grant.granteeUserId)) continue;
      seen.add(grant.granteeUserId);
      users.push(grant.granteeUser);
    }
    return users;
  }

  async create(dto: CreateOperationalAccessGrantDto, grantedByUserId: string) {
    if (dto.grantType === 'person_delegation' && !dto.principalUserId) {
      throw new BadRequestException('Kişi vekaletinde asıl sorumlu seçilmelidir');
    }
    if (dto.grantType === 'function_delegation' && dto.principalUserId) {
      throw new BadRequestException('Fonksiyon vekaletinde asıl sorumlu belirtilmemelidir');
    }
    if (dto.granteeUserId === dto.principalUserId) {
      throw new BadRequestException('Vekil ve asıl sorumlu aynı kullanıcı olamaz');
    }

    const grantee = await this.prisma.user.findUnique({ where: { id: dto.granteeUserId } });
    if (!grantee) throw new BadRequestException('Vekil kullanıcı bulunamadı');

    if (dto.principalUserId) {
      const principal = await this.prisma.user.findUnique({ where: { id: dto.principalUserId } });
      if (!principal) throw new BadRequestException('Asıl sorumlu bulunamadı');
    }

    const validFrom = new Date(dto.validFrom);
    const validTo = dto.validTo ? new Date(dto.validTo) : null;
    if (Number.isNaN(validFrom.getTime())) {
      throw new BadRequestException('Geçerli başlangıç tarihi girin');
    }
    if (validTo && Number.isNaN(validTo.getTime())) {
      throw new BadRequestException('Geçerli bitiş tarihi girin');
    }
    if (validTo && validTo < validFrom) {
      throw new BadRequestException('Bitiş tarihi başlangıçtan önce olamaz');
    }

    return this.prisma.operationalAccessGrant.create({
      data: {
        granteeUserId: dto.granteeUserId,
        principalUserId: dto.principalUserId ?? null,
        scopeType: dto.scopeType,
        grantType: dto.grantType as OperationalGrantType,
        accessLevel: dto.accessLevel ?? 'manage',
        validFrom,
        validTo,
        reason: dto.reason?.trim() || null,
        grantedByUserId,
        isActive: true,
      },
      include: {
        principalUser: { select: USER_SELECT },
        grantedByUser: { select: USER_SELECT },
      },
    });
  }

  async deactivate(id: string) {
    const existing = await this.prisma.operationalAccessGrant.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Vekalet kaydı bulunamadı');

    return this.prisma.operationalAccessGrant.update({
      where: { id },
      data: { isActive: false },
      include: {
        principalUser: { select: USER_SELECT },
        grantedByUser: { select: USER_SELECT },
      },
    });
  }
}
