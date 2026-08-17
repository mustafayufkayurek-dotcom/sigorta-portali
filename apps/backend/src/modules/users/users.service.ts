import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditLogsService } from '@/modules/audit-logs/audit-logs.service';
import { EmailService } from '@/modules/notifications/email/email.service';
import { WelcomeEmailRole } from '@/modules/notifications/email/welcome-email.template';
import { buildAppPath } from '@/common/utils/app-url';
import { normalizeEmailAddress } from '@/common/utils/normalize-email';
import { applyTitleCase } from '@/common/utils/text-helpers';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';
import { pickUserWriteScalars } from './user-update-fields';
import { ALL_SCREEN_CODES, SCREEN_LABELS, getDefaultScreensForRole } from './screen-permissions.defaults';

function normalizeUserEmail(email: string): string {
  return normalizeEmailAddress(email);
}

function isInactiveUserStatus(status: string | null | undefined): boolean {
  const normalized = String(status ?? '').trim().toLowerCase();
  return normalized === 'inactive' || normalized === 'passive' || normalized === 'pasif' || normalized === 'archived';
}

function isArchivedUserStatus(status: string | null | undefined): boolean {
  const normalized = String(status ?? '').trim().toLowerCase();
  return normalized === 'archived' || normalized === 'arsiv' || normalized === 'arşiv';
}

function generateTemporaryPassword(length = 12): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#%';
  const pool = `${upper}${lower}${digits}${symbols}`;
  const chars = [
    upper[randomInt(upper.length)],
    lower[randomInt(lower.length)],
    digits[randomInt(digits.length)],
    symbols[randomInt(symbols.length)],
  ];

  while (chars.length < length) {
    chars.push(pool[randomInt(pool.length)]);
  }

  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
}

const PROTECTED_SYSTEM_EMAILS = new Set([
  'admin@example.com',
  'admin@meridyenassistance.com',
]);

const HASAR_EXPERT_CUSTOMER_SUB_TYPES = new Set(['eksper_firmasi', 'eksper']);
const BROKER_CUSTOMER_SUB_TYPE = 'broker_firmasi';
const ASSISTANT_CUSTOMER_SUB_TYPE = 'asistan_firmasi';

type WelcomeOrgParams = {
  roleCode?: string | null;
  branchName?: string | null;
  adjusterCompany?: string | null;
  adjusterName?: string | null;
  insuranceCompanyName?: string | null;
  brokerOrganizationName?: string | null;
  assistantOrganizationName?: string | null;
};

type InvitePortalContext = {
  expertCustomerId?: string | null;
  brokerCustomerId?: string | null;
  insuranceCompanyIds?: string[] | null;
  assistantCustomerIds?: string[] | null;
};

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
  ) {}

  async findAll(params?: { page?: number; limit?: number; roleId?: string; branchId?: string }) {
    const page = parseInt(String(params?.page || 1), 10);
    const limit = parseInt(String(params?.limit || 20), 10);
    const skip = (page - 1) * limit;

    const where: any = {};
    if ((params as any)?.includeInactive !== 'true') {
      where.status = { notIn: ['inactive', 'INACTIVE', 'archived', 'ARCHIVED'] };
    }
    if (params?.roleId) where.roleId = params.roleId;
    if (params?.branchId) where.branchId = params.branchId;

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        include: {
          role: true,
          branch: true,
          departmentMemberships: {
            where: { isActive: true },
            include: {
              department: {
                select: { id: true, code: true, name: true },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
          userInsuranceCompanyScopes: {
            include: {
              insuranceCompany: {
                select: { id: true, name: true },
              },
            },
          },
          userAssistantCustomerScopes: {
            include: {
              customer: {
                select: { id: true, companyName: true, fullName: true },
              },
            },
          },
          serviceAreas: {
            include: {
              province: { select: { id: true, name: true, plateCode: true } },
              district: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    const grantRows = data.length > 0
      ? await this.prisma.operationalAccessGrant.findMany({
          where: {
            granteeUserId: { in: data.map((user) => user.id) },
            isActive: true,
            validFrom: { lte: new Date() },
            OR: [{ validTo: null }, { validTo: { gte: new Date() } }],
          },
          include: {
            principalUser: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
          orderBy: [{ validFrom: 'desc' }, { createdAt: 'desc' }],
        })
      : [];

    const grantsByUserId = new Map<string, typeof grantRows>();
    for (const grant of grantRows) {
      const bucket = grantsByUserId.get(grant.granteeUserId) ?? [];
      bucket.push(grant);
      grantsByUserId.set(grant.granteeUserId, bucket);
    }

    return {
      data: data.map((u) => {
        const { passwordHash, ...user } = u;
        const grants = grantsByUserId.get(u.id) ?? [];
        return {
          ...user,
          operationalAccessGrants: grants.map((grant) => ({
            id: grant.id,
            scopeType: grant.scopeType,
            grantType: grant.grantType,
            accessLevel: grant.accessLevel,
            validFrom: grant.validFrom.toISOString(),
            validTo: grant.validTo ? grant.validTo.toISOString() : null,
            principalUserId: grant.principalUserId,
            principalUser: grant.principalUser
              ? {
                  id: grant.principalUser.id,
                  firstName: grant.principalUser.firstName,
                  lastName: grant.principalUser.lastName,
                }
              : null,
          })),
        };
      }),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
        branch: true,
        userInsuranceCompanyScopes: {
          include: {
            insuranceCompany: true,
          },
        },
        userAssistantCustomerScopes: {
          include: {
            customer: {
              select: { id: true, companyName: true, fullName: true },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }

    const { passwordHash, ...result } = user;
    return result;
  }

  async create(data: any) {
    const normalizedEmail = normalizeUserEmail(data.email);
    if (!normalizedEmail) {
      throw new BadRequestException('Geçerli bir e-posta adresi girilmelidir');
    }

    const existingUser = await this.findUserByMailbox(normalizedEmail);

    if (existingUser) {
      if (isInactiveUserStatus(existingUser.status)) {
        return this.reinviteInactiveUser(existingUser, data);
      }
      throw new BadRequestException('Bu e-posta adresi zaten kullanılıyor');
    }

    applyTitleCase(data, ['firstName', 'lastName']);

    const {
      password,
      departmentMemberships,
      responsibilityAssignments,
      serviceAreas,
      insuranceCompanyIds,
      assistantCustomerIds,
      expertCustomerId,
      brokerCustomerId,
    } = data;
    const rest: any = pickUserWriteScalars(data);
    await this.validateNestedUserRelations(departmentMemberships, responsibilityAssignments);
    await this.validatePortalInviteContext(rest.roleId, {
      expertCustomerId,
      brokerCustomerId,
      insuranceCompanyIds,
      assistantCustomerIds,
    });

    const temporaryPassword = typeof password === 'string' && password.trim().length > 0
      ? password.trim()
      : generateTemporaryPassword();
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    const user = await this.prisma.$transaction(async (tx) => {
      const adjusterId = await this.resolveExpertAdjusterIdForInvite(tx, {
        roleId: rest.roleId,
        adjusterId: rest.adjusterId,
        expertCustomerId,
        firstName: rest.firstName,
        lastName: rest.lastName,
        email: normalizedEmail,
        phone: rest.phone,
      });

      const { expertCustomerId: _expertCustomerId, brokerCustomerId: _brokerCustomerId, ...userData } = rest;

      const createdUser = await tx.user.create({
        data: {
          ...userData,
          adjusterId,
          email: normalizedEmail,
          passwordHash: hashedPassword,
          mustChangePassword: true,
          temporaryPasswordIssuedAt: new Date(),
          status: userData.status ?? 'active',
        },
        include: {
          role: true,
          branch: true,
          adjuster: true,
          userInsuranceCompanyScopes: {
            include: { insuranceCompany: { select: { id: true, name: true } } },
            take: 1,
          },
        },
      });

      if (Array.isArray(departmentMemberships) && departmentMemberships.length > 0) {
        await tx.userDepartmentMembership.createMany({
          data: departmentMemberships.map((item: any) => ({
            userId: createdUser.id,
            departmentId: item.departmentId,
            isPrimary: item.isPrimary === true,
            roleScope: item.roleScope ?? null,
            isActive: item.isActive ?? true,
          })),
          skipDuplicates: true,
        });
      }

      if (Array.isArray(responsibilityAssignments) && responsibilityAssignments.length > 0) {
        await tx.claimResponsibilityAssignment.createMany({
          data: responsibilityAssignments.map((item: any) => ({
            userId: createdUser.id,
            departmentId: item.departmentId,
            regionType: item.regionType ?? (item.countrywide === false ? 'city' : 'countrywide'),
            regionValues: item.regionValues ?? [],
            coverageType: item.coverageType ?? 'all',
            coverageConfig: item.coverageConfig ?? {},
            priority: typeof item.priority === 'number' ? item.priority : 0,
            isActive: item.isActive ?? true,
          })),
        });
      }

      if (Array.isArray(serviceAreas) && serviceAreas.length > 0) {
        await tx.userServiceArea.createMany({
          data: serviceAreas.map((item: any) => ({
            userId: createdUser.id,
            provinceId: item.provinceId,
            districtId: item.districtId ?? null,
          })),
          skipDuplicates: true,
        });
      }

      if (Array.isArray(insuranceCompanyIds) && insuranceCompanyIds.length > 0) {
        await tx.userInsuranceCompanyScope.createMany({
          data: insuranceCompanyIds.map((insuranceCompanyId: string) => ({
            userId: createdUser.id,
            insuranceCompanyId,
          })),
          skipDuplicates: true,
        });
      }

      if (Array.isArray(assistantCustomerIds) && assistantCustomerIds.length > 0) {
        await tx.userAssistantCustomerScope.createMany({
          data: assistantCustomerIds.map((customerId: string) => ({
            userId: createdUser.id,
            customerId,
          })),
          skipDuplicates: true,
        });
      }

      return createdUser;
    });

    const { passwordHash, ...result } = user;
    const organizationName = await this.resolveWelcomeOrganizationNameForUser(result, {
      brokerCustomerId,
      insuranceCompanyIds,
      assistantCustomerIds,
    });
    const welcomeEmail = await this.sendWelcomeInviteEmail({
      email: normalizedEmail,
      firstName: result.firstName,
      lastName: result.lastName,
      temporaryPassword,
      roleCode: result.role?.code,
      organizationName,
    });

    return {
      ...result,
      temporaryPassword,
      welcomeEmail,
    };
  }

  private async reinviteInactiveUser(
    existingUser: { id: string; email: string; status: string; archivedEmail?: string | null },
    data: any,
  ) {
    applyTitleCase(data, ['firstName', 'lastName']);

    const temporaryPassword = typeof data.password === 'string' && data.password.trim().length > 0
      ? data.password.trim()
      : generateTemporaryPassword();

    const {
      password: _password,
      email: _email,
      departmentMemberships,
      responsibilityAssignments,
      serviceAreas,
      insuranceCompanyIds,
      assistantCustomerIds,
      expertCustomerId,
      brokerCustomerId,
      ...rest
    } = data;

    const restoreEmail = normalizeUserEmail(
      existingUser.archivedEmail ?? existingUser.email ?? data.email,
    );

    const activeConflict = await this.findActiveUserByMailbox(restoreEmail, existingUser.id);
    if (activeConflict) {
      throw new BadRequestException('Bu e-posta adresi başka bir aktif kullanıcıda kayıtlı');
    }

    await this.validatePortalInviteContext(rest.roleId, {
      expertCustomerId,
      brokerCustomerId,
      insuranceCompanyIds,
      assistantCustomerIds,
    });

    const reactivated = await this.update(existingUser.id, {
      ...rest,
      email: restoreEmail,
      archivedEmail: null,
      archivedAt: null,
      status: 'active',
      password: temporaryPassword,
      departmentMemberships,
      responsibilityAssignments,
      serviceAreas,
      insuranceCompanyIds,
      assistantCustomerIds,
      expertCustomerId,
      brokerCustomerId,
    });

    this.auditLogsService.log({
      entityType: 'User',
      entityId: existingUser.id,
      action: isArchivedUserStatus(existingUser.status) ? 'USER_REARCHIVE_REINVITE' : 'USER_REINVITE',
      oldValue: { status: existingUser.status, email: existingUser.email, archivedEmail: existingUser.archivedEmail ?? null },
      newValue: { status: 'active', email: restoreEmail },
      userId: existingUser.id,
      userEmail: restoreEmail,
    });

    const reactivatedUser = reactivated as typeof reactivated & {
      role?: { code?: string | null } | null;
      branch?: { name?: string | null } | null;
      adjuster?: { company?: string | null; name?: string | null } | null;
      userInsuranceCompanyScopes?: Array<{ insuranceCompany?: { name?: string | null } | null }>;
    };

    const organizationName = await this.resolveWelcomeOrganizationNameForUser(reactivatedUser, {
      brokerCustomerId,
      insuranceCompanyIds,
      assistantCustomerIds,
    });

    const welcomeEmail = await this.sendWelcomeInviteEmail({
      email: restoreEmail,
      firstName: reactivated.firstName,
      lastName: reactivated.lastName,
      temporaryPassword,
      roleCode: reactivatedUser.role?.code,
      organizationName,
    });

    return {
      ...reactivated,
      temporaryPassword,
      welcomeEmail,
      reinvited: true,
    };
  }

  private roleCodeToWelcomeRole(roleCode?: string | null): WelcomeEmailRole {
    if (roleCode === 'expert') return 'EXPERT';
    if (roleCode === 'insurance_company_user') return 'INSURANCE_COMPANY';
    if (roleCode === 'broker_user') return 'BROKER';
    if (roleCode === 'assistance_company_user') return 'MERIDYEN_STAFF';
    return 'MERIDYEN_STAFF';
  }

  private guidePathForWelcomeRole(role: WelcomeEmailRole): string {
    switch (role) {
      case 'EXPERT':
        return '/docs/03-eksper-portal-tanitim.pdf';
      case 'INSURANCE_COMPANY':
        return '/docs/02-sigorta-portal-kilavuzu.pdf';
      case 'BROKER':
        return '/docs/04-broker-portal-kilavuzu.pdf';
      default:
        return '/docs/01-personel-kullanim-kilavuzu.pdf';
    }
  }

  private resolveWelcomeOrganizationName(params: WelcomeOrgParams): string | undefined {
    const role = this.roleCodeToWelcomeRole(params.roleCode);
    if (role === 'EXPERT') {
      return (
        params.adjusterCompany?.trim() ||
        params.adjusterName?.trim() ||
        params.branchName?.trim() ||
        undefined
      );
    }
    if (role === 'INSURANCE_COMPANY') {
      return params.insuranceCompanyName?.trim() || params.branchName?.trim() || undefined;
    }
    if (role === 'BROKER') {
      return params.brokerOrganizationName?.trim() || params.branchName?.trim() || undefined;
    }
    if (params.roleCode === 'assistance_company_user') {
      return params.assistantOrganizationName?.trim() || params.branchName?.trim() || undefined;
    }
    return params.branchName?.trim() || undefined;
  }

  private async resolveWelcomeOrganizationNameForUser(
    user: {
      role?: { code?: string | null } | null;
      branch?: { name?: string | null } | null;
      adjuster?: { company?: string | null; name?: string | null } | null;
      userInsuranceCompanyScopes?: Array<{ insuranceCompany?: { name?: string | null } | null }>;
    },
    context: InvitePortalContext,
  ): Promise<string | undefined> {
    const insuranceFromUser = user.userInsuranceCompanyScopes?.[0]?.insuranceCompany?.name;
    const insuranceCompanyName = insuranceFromUser
      ?? (context.insuranceCompanyIds?.[0]
        ? (await this.prisma.insuranceCompany.findUnique({
            where: { id: context.insuranceCompanyIds[0] },
            select: { name: true },
          }))?.name
        : undefined);

    return this.resolveWelcomeOrganizationName({
      roleCode: user.role?.code,
      branchName: user.branch?.name,
      adjusterCompany: user.adjuster?.company,
      adjusterName: user.adjuster?.name,
      insuranceCompanyName: insuranceCompanyName ?? undefined,
      brokerOrganizationName: await this.resolveBrokerOrganizationName(context.brokerCustomerId),
      assistantOrganizationName: await this.resolveAssistantOrganizationName(context.assistantCustomerIds?.[0]),
    });
  }

  private async resolveAssistantOrganizationName(assistantCustomerId?: string | null): Promise<string | undefined> {
    if (!assistantCustomerId) return undefined;
    const customer = await this.prisma.customer.findUnique({ where: { id: assistantCustomerId } });
    if (!customer || customer.status !== 'active') return undefined;
    if (customer.entityType !== 'corporate' || customer.subType !== ASSISTANT_CUSTOMER_SUB_TYPE) {
      return undefined;
    }
    return (customer.companyName ?? customer.fullName ?? '').trim() || undefined;
  }

  private async resolveBrokerOrganizationName(brokerCustomerId?: string | null): Promise<string | undefined> {
    if (!brokerCustomerId) return undefined;
    const customer = await this.prisma.customer.findUnique({ where: { id: brokerCustomerId } });
    if (!customer || customer.status !== 'active') return undefined;
    if (customer.entityType !== 'corporate' || customer.subType !== BROKER_CUSTOMER_SUB_TYPE) {
      return undefined;
    }
    return (customer.companyName ?? customer.fullName ?? '').trim() || undefined;
  }

  private async validatePortalInviteContext(
    roleId: string | undefined,
    context: InvitePortalContext,
    mode: 'create' | 'update' = 'create',
    options?: { existingAdjusterId?: string | null },
  ): Promise<void> {
    if (!roleId) return;
    const role = await this.prisma.role.findUnique({ where: { id: roleId }, select: { code: true } });
    if (!role) return;

    if (mode === 'create') {
      if (role.code === 'expert' && !context.expertCustomerId) {
        throw new BadRequestException('Ekspertiz firması seçilmelidir');
      }
      if (role.code === 'broker_user' && !context.brokerCustomerId) {
        throw new BadRequestException('Broker firması seçilmelidir');
      }
      if (role.code === 'insurance_company_user' && (!context.insuranceCompanyIds || context.insuranceCompanyIds.length !== 1)) {
        throw new BadRequestException('Sigorta şirketi seçilmelidir');
      }
      if (role.code === 'assistance_company_user' && (!context.assistantCustomerIds || context.assistantCustomerIds.length !== 1)) {
        throw new BadRequestException('Asistans firması seçilmelidir');
      }
    }

    if (mode === 'update' && role.code === 'expert' && !context.expertCustomerId && !options?.existingAdjusterId) {
      throw new BadRequestException('Ekspertiz firması seçilmelidir');
    }

    if (mode === 'update' && role.code === 'broker_user' && !context.brokerCustomerId) {
      // Broker firması yalnızca davet sırasında zorunlu; düzenlemede kalıcı bağ henüz yok.
    }

    if (context.expertCustomerId) {
      const customer = await this.prisma.customer.findUnique({ where: { id: context.expertCustomerId } });
      if (!customer || customer.status !== 'active' || customer.entityType !== 'corporate') {
        throw new BadRequestException('Geçerli bir ekspertiz firması seçilmelidir');
      }
      if (!customer.subType || !HASAR_EXPERT_CUSTOMER_SUB_TYPES.has(customer.subType)) {
        throw new BadRequestException('Seçilen kayıt ekspertiz firması değil');
      }
    }

    if (context.brokerCustomerId) {
      const customer = await this.prisma.customer.findUnique({ where: { id: context.brokerCustomerId } });
      if (!customer || customer.status !== 'active' || customer.entityType !== 'corporate') {
        throw new BadRequestException('Geçerli bir broker firması seçilmelidir');
      }
      if (customer.subType !== BROKER_CUSTOMER_SUB_TYPE) {
        throw new BadRequestException('Seçilen kayıt broker firması değil');
      }
    }

    if (context.assistantCustomerIds?.length) {
      const customers = await this.prisma.customer.findMany({
        where: { id: { in: context.assistantCustomerIds } },
        select: { id: true, status: true, entityType: true, subType: true },
      });
      if (customers.length !== context.assistantCustomerIds.length) {
        throw new BadRequestException('Geçerli bir asistans firması seçilmelidir');
      }
      for (const customer of customers) {
        if (customer.status !== 'active' || customer.entityType !== 'corporate' || customer.subType !== ASSISTANT_CUSTOMER_SUB_TYPE) {
          throw new BadRequestException('Seçilen kayıt asistans firması değil');
        }
      }
    }
  }

  private async resolveExpertAdjusterIdForInvite(
    tx: Prisma.TransactionClient,
    params: {
      roleId?: string;
      adjusterId?: string | null;
      expertCustomerId?: string | null;
      firstName?: string;
      lastName?: string;
      email: string;
      phone?: string | null;
    },
  ): Promise<string | undefined> {
    if (!params.roleId) return params.adjusterId ?? undefined;

    const role = await tx.role.findUnique({ where: { id: params.roleId }, select: { code: true } });
    if (role?.code !== 'expert') {
      return params.adjusterId ?? undefined;
    }

    if (params.adjusterId) {
      return params.adjusterId;
    }

    if (!params.expertCustomerId) {
      throw new BadRequestException('Ekspertiz firması seçilmelidir');
    }

    return this.ensureExpertAdjusterForInvite(tx, {
      expertCustomerId: params.expertCustomerId,
      firstName: params.firstName ?? '',
      lastName: params.lastName ?? '',
      email: params.email,
      phone: params.phone,
    });
  }

  private async ensureExpertAdjusterForInvite(
    tx: Prisma.TransactionClient,
    params: {
      expertCustomerId: string;
      firstName: string;
      lastName: string;
      email: string;
      phone?: string | null;
    },
  ): Promise<string> {
    const customer = await tx.customer.findUnique({ where: { id: params.expertCustomerId } });
    if (!customer || customer.status !== 'active' || customer.entityType !== 'corporate') {
      throw new BadRequestException('Geçerli bir ekspertiz firması seçilmelidir');
    }
    if (!customer.subType || !HASAR_EXPERT_CUSTOMER_SUB_TYPES.has(customer.subType)) {
      throw new BadRequestException('Seçilen kayıt ekspertiz firması değil');
    }

    const companyName = (customer.companyName ?? customer.fullName ?? '').trim();
    if (!companyName) {
      throw new BadRequestException('Seçilen ekspertiz firmasının unvanı eksik');
    }

    const personName = [params.firstName, params.lastName].map((part) => part?.trim()).filter(Boolean).join(' ');
    const normalizedEmail = normalizeUserEmail(params.email);

    const linkedUser = await tx.user.findFirst({
      where: { email: normalizedEmail },
      select: { adjusterId: true },
    });
    if (linkedUser?.adjusterId) {
      const existingAdjuster = await tx.adjuster.findUnique({ where: { id: linkedUser.adjusterId } });
      if (existingAdjuster) {
        return existingAdjuster.id;
      }
    }

    const existingAdjuster = await tx.adjuster.findFirst({
      where: {
        email: normalizedEmail,
        company: companyName,
        status: 'active',
      },
    });
    if (existingAdjuster) {
      const adjusterInUse = await tx.user.findFirst({
        where: { adjusterId: existingAdjuster.id },
        select: { id: true },
      });
      if (!adjusterInUse) {
        return existingAdjuster.id;
      }
    }

    const adjuster = await tx.adjuster.create({
      data: {
        name: personName || companyName,
        company: companyName,
        email: normalizedEmail,
        phone: params.phone?.trim() || customer.phone || undefined,
        city: customer.city || undefined,
        status: 'active',
      },
    });
    return adjuster.id;
  }

  private async sendWelcomeInviteEmail(params: {
    email: string;
    firstName: string;
    lastName: string;
    temporaryPassword: string;
    roleCode?: string | null;
    organizationName?: string | null;
  }): Promise<{ sent: boolean; message: string }> {
    const loginUrl = buildAppPath(this.config, '/giris');
    const role = this.roleCodeToWelcomeRole(params.roleCode);

    const recipientName = [params.firstName, params.lastName]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(' ');

    const result = await this.emailService.sendWelcomeEmail(params.email, role, {
      recipientName: recipientName || undefined,
      organizationName: params.organizationName?.trim() || undefined,
      portalUrl: loginUrl,
      guideUrl: buildAppPath(this.config, this.guidePathForWelcomeRole(role)),
      accountEmail: params.email,
      temporaryPassword: params.temporaryPassword,
      forcePasswordChange: true,
    });

    if (!result.sent) {
      return {
        sent: false,
        message: result.errorMsg
          ? `Hoş geldin e-postası gönderilemedi: ${result.errorMsg} Geçici şifreyi kullanıcıya manuel iletin.`
          : 'Hoş geldin e-postası gönderilemedi. Geçici şifreyi kullanıcıya manuel iletin.',
      };
    }

    return {
      sent: true,
      message: 'Hoş geldin e-postası gönderildi.',
    };
  }

  async update(id: string, data: any) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }

    if (PROTECTED_SYSTEM_EMAILS.has(user.email)) {
      throw new BadRequestException('Sistem yöneticisi düzenlenemez');
    }

    applyTitleCase(data, ['firstName', 'lastName']);

    const {
      password,
      oldPassword,
      departmentMemberships,
      responsibilityAssignments,
      serviceAreas,
      insuranceCompanyIds,
      assistantCustomerIds,
      expertCustomerId,
      brokerCustomerId,
    } = data;
    const rest: any = pickUserWriteScalars(data);
    await this.validateNestedUserRelations(departmentMemberships, responsibilityAssignments);

    const updateData: any = { ...rest };
    if (updateData.email !== undefined) {
      const normalizedEmail = normalizeUserEmail(updateData.email);
      if (!normalizedEmail) {
        throw new BadRequestException('Geçerli bir e-posta adresi girilmelidir');
      }
      const conflict = await this.findActiveUserByMailbox(normalizedEmail, id);
      if (conflict) {
        throw new BadRequestException('Bu e-posta adresi başka bir aktif kullanıcıda kayıtlı');
      }
      updateData.email = normalizedEmail;
    }
    let issuedTemporaryPassword: string | undefined;

    if (password) {
      if (oldPassword) {
        const isCurrentPasswordValid = await bcrypt.compare(oldPassword, user.passwordHash);
        if (!isCurrentPasswordValid) {
          throw new BadRequestException('Mevcut şifre hatalı');
        }
        updateData.passwordHash = await bcrypt.hash(password, 10);
        updateData.mustChangePassword = false;
        updateData.temporaryPasswordIssuedAt = null;
      } else {
        updateData.passwordHash = await bcrypt.hash(password, 10);
        updateData.mustChangePassword = true;
        updateData.temporaryPasswordIssuedAt = new Date();
      }
    }

    const roleChanged = updateData.roleId !== undefined && updateData.roleId !== user.roleId;
    if (roleChanged && !password) {
      issuedTemporaryPassword = generateTemporaryPassword();
      updateData.passwordHash = await bcrypt.hash(issuedTemporaryPassword, 10);
      updateData.mustChangePassword = true;
      updateData.temporaryPasswordIssuedAt = new Date();
    }

    const shouldRevokeSessions = Boolean(password) || roleChanged;
    const hasNestedUpdates =
      Array.isArray(departmentMemberships) ||
      Array.isArray(responsibilityAssignments) ||
      Array.isArray(serviceAreas) ||
      Array.isArray(insuranceCompanyIds) ||
      Array.isArray(assistantCustomerIds);

    const include = {
      role: true,
      branch: true,
      adjuster: true,
      departmentMemberships: {
        where: { isActive: true },
        include: {
          department: {
            select: { id: true, code: true, name: true },
          },
        },
        orderBy: { createdAt: 'asc' as const },
      },
      userInsuranceCompanyScopes: {
        include: {
          insuranceCompany: {
            select: { id: true, name: true },
          },
        },
      },
      userAssistantCustomerScopes: {
        include: {
          customer: {
            select: { id: true, companyName: true, fullName: true },
          },
        },
      },
      serviceAreas: {
        include: {
          province: { select: { id: true, name: true, plateCode: true } },
          district: { select: { id: true, name: true } },
        },
      },
    };
    const updateArgs: any = {
      where: { id },
      data: updateData,
      include,
    };

    const roleIdForInvite = updateData.roleId ?? user.roleId;
    await this.validatePortalInviteContext(roleIdForInvite, {
      expertCustomerId,
      brokerCustomerId,
      insuranceCompanyIds,
      assistantCustomerIds,
    }, 'update', { existingAdjusterId: user.adjusterId });

    const updated = roleChanged || hasNestedUpdates
      ? await this.prisma.$transaction(async (tx) => {
          const resolvedAdjusterId = await this.resolveExpertAdjusterIdForInvite(tx, {
            roleId: roleIdForInvite,
            adjusterId: updateData.adjusterId ?? user.adjusterId,
            expertCustomerId,
            firstName: updateData.firstName ?? user.firstName,
            lastName: updateData.lastName ?? user.lastName,
            email: updateData.email ?? user.email,
            phone: updateData.phone ?? user.phone,
          });
          if (resolvedAdjusterId) {
            updateData.adjusterId = resolvedAdjusterId;
          }

          if (roleChanged) {
            await tx.screenPermission.deleteMany({ where: { userId: id } });
          }
          if (roleChanged || Array.isArray(serviceAreas)) {
            await tx.userServiceArea.deleteMany({ where: { userId: id } });
          }
          if (roleChanged || Array.isArray(departmentMemberships)) {
            await tx.userDepartmentMembership.deleteMany({ where: { userId: id } });
          }
          if (roleChanged || Array.isArray(responsibilityAssignments)) {
            await tx.claimResponsibilityAssignment.deleteMany({ where: { userId: id } });
          }
          if (roleChanged || Array.isArray(insuranceCompanyIds)) {
            await tx.userInsuranceCompanyScope.deleteMany({ where: { userId: id } });
          }
          if (roleChanged || Array.isArray(assistantCustomerIds)) {
            await tx.userAssistantCustomerScope.deleteMany({ where: { userId: id } });
          }

          if (roleChanged) {
            this.auditLogsService.log({
              entityType: 'User',
              entityId: id,
              action: 'ROLE_SWITCH_CLEANUP',
              oldValue: { roleId: user.roleId },
              newValue: { roleId: updateData.roleId },
              userId: id,
              userEmail: user.email,
            });
          }

          if (shouldRevokeSessions) {
            await tx.refreshToken.updateMany({
              where: { userId: id, revokedAt: null },
              data: { revokedAt: new Date() },
            });
          }

          await tx.user.update(updateArgs);

          if (Array.isArray(departmentMemberships) && departmentMemberships.length > 0) {
            await tx.userDepartmentMembership.createMany({
              data: departmentMemberships.map((item: any) => ({
                userId: id,
                departmentId: item.departmentId,
                isPrimary: item.isPrimary === true,
                roleScope: item.roleScope ?? null,
                isActive: item.isActive ?? true,
              })),
              skipDuplicates: true,
            });
          }

          if (Array.isArray(responsibilityAssignments) && responsibilityAssignments.length > 0) {
            await tx.claimResponsibilityAssignment.createMany({
              data: responsibilityAssignments.map((item: any) => ({
                userId: id,
                departmentId: item.departmentId,
                regionType: item.regionType ?? (item.countrywide === false ? 'city' : 'countrywide'),
                regionValues: item.regionValues ?? [],
                coverageType: item.coverageType ?? 'all',
                coverageConfig: item.coverageConfig ?? {},
                priority: typeof item.priority === 'number' ? item.priority : 0,
                isActive: item.isActive ?? true,
              })),
            });
          }

          if (Array.isArray(serviceAreas)) {
            if (serviceAreas.length > 0) {
              await tx.userServiceArea.createMany({
                data: serviceAreas.map((item: any) => ({
                  userId: id,
                  provinceId: item.provinceId,
                  districtId: item.districtId ?? null,
                })),
                skipDuplicates: true,
              });
            }
          }

          if (Array.isArray(insuranceCompanyIds) && insuranceCompanyIds.length > 0) {
            await tx.userInsuranceCompanyScope.createMany({
              data: insuranceCompanyIds.map((insuranceCompanyId: string) => ({
                userId: id,
                insuranceCompanyId,
              })),
              skipDuplicates: true,
            });
          }

          if (Array.isArray(assistantCustomerIds) && assistantCustomerIds.length > 0) {
            await tx.userAssistantCustomerScope.createMany({
              data: assistantCustomerIds.map((customerId: string) => ({
                userId: id,
                customerId,
              })),
              skipDuplicates: true,
            });
          }

          return tx.user.findUnique({ where: { id }, include });
        })
      : await this.prisma.$transaction(async (tx) => {
          if (shouldRevokeSessions) {
            await tx.refreshToken.updateMany({
              where: { userId: id, revokedAt: null },
              data: { revokedAt: new Date() },
            });
          }
          return tx.user.update(updateArgs);
        });

    const finalUpdated = updated ?? await this.prisma.user.findUnique({ where: { id }, include });
    if (!finalUpdated) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }

    if (updateData.roleId !== undefined || updateData.status !== undefined) {
      this.auditLogsService.log({
        entityType: 'User',
        entityId: id,
        action: 'UPDATE',
        oldValue: { roleId: user.roleId, status: user.status },
        newValue: { roleId: finalUpdated.roleId, status: finalUpdated.status },
        userId: id,
        userEmail: finalUpdated.email,
      });
    }

    if (issuedTemporaryPassword) {
      const issuedRoleId = updateData.roleId ?? finalUpdated.roleId;
      const issuedRole = issuedRoleId
        ? await this.prisma.role.findUnique({
            where: { id: issuedRoleId },
            select: { code: true },
          })
        : null;
      this.auditLogsService.log({
        entityType: 'User',
        entityId: id,
        action: 'TEMPORARY_PASSWORD_ISSUED',
        newValue: {
          issuedForEmail: finalUpdated.email,
          issuedForRole: issuedRole?.code ?? null,
          reason: 'role_change',
        },
        userId: id,
        userEmail: finalUpdated.email,
      });
    }

    const { passwordHash, ...result } = finalUpdated;
    return issuedTemporaryPassword
      ? { ...result, temporaryPassword: issuedTemporaryPassword }
      : result;
  }

  private async validateNestedUserRelations(
    departmentMemberships?: Array<{ departmentId: string; isPrimary?: boolean }>,
    responsibilityAssignments?: Array<{ departmentId: string }>,
  ) {
    if (!Array.isArray(departmentMemberships) || departmentMemberships.length === 0) {
      return;
    }

    const primaryCount = departmentMemberships.filter((item) => item.isPrimary === true).length;
    if (primaryCount < 1) {
      throw new BadRequestException('En az 1 adet birincil departman üyeliği zorunludur');
    }

    const departmentIds = [...new Set(departmentMemberships.map((item) => item.departmentId).filter(Boolean))];
    const existingDepartments = await this.prisma.department.findMany({
      where: { id: { in: departmentIds } },
      select: { id: true },
    });
    if (existingDepartments.length !== departmentIds.length) {
      throw new BadRequestException('Geçersiz departman seçimi');
    }

    if (Array.isArray(responsibilityAssignments) && responsibilityAssignments.length > 0) {
      const membershipSet = new Set(departmentIds);
      const invalidAssignment = responsibilityAssignments.find((item) => !membershipSet.has(item.departmentId));
      if (invalidAssignment) {
        throw new BadRequestException('Sorumluluk ataması seçili departmanlardan biri için yapılmalıdır');
      }
    }
  }

  async issueTemporaryPassword(id: string, actor?: any) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { role: true },
    });
    if (!user) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }

    if (PROTECTED_SYSTEM_EMAILS.has(user.email)) {
      throw new BadRequestException('Sistem yöneticisi için geçici şifre üretilemez');
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);
    const issuedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          passwordHash,
          mustChangePassword: true,
          temporaryPasswordIssuedAt: issuedAt,
        },
      });
      await tx.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: issuedAt },
      });
    });

    this.auditLogsService.log({
      entityType: 'User',
      entityId: id,
      action: 'TEMPORARY_PASSWORD_ISSUED',
      newValue: {
        issuedForEmail: user.email,
        issuedForRole: user.role?.code ?? null,
      },
      userId: actor?.id ?? actor?.userId ?? 'system',
      userEmail: actor?.email ?? actor?.userEmail ?? 'system',
    });

    return { temporaryPassword };
  }

  async remove(id: string) {
    return this.archiveUser(id);
  }

  private buildArchivedEmailPlaceholder(userId: string): string {
    return `archived+${userId.replace(/-/g, '').slice(0, 12)}@deleted.meridyen.local`;
  }

  private async findUserByMailbox(email: string) {
    const normalizedEmail = normalizeUserEmail(email);
    if (!normalizedEmail) return null;

    return this.prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: normalizedEmail, mode: 'insensitive' } },
          { archivedEmail: { equals: normalizedEmail, mode: 'insensitive' } },
        ],
      },
    });
  }

  private async findActiveUserByMailbox(email: string, excludeUserId?: string) {
    const normalizedEmail = normalizeUserEmail(email);
    if (!normalizedEmail) return null;

    return this.prisma.user.findFirst({
      where: {
        ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
        status: { notIn: ['inactive', 'INACTIVE', 'archived', 'ARCHIVED', 'passive', 'PASIF'] },
        OR: [
          { email: { equals: normalizedEmail, mode: 'insensitive' } },
          { archivedEmail: { equals: normalizedEmail, mode: 'insensitive' } },
        ],
      },
    });
  }

  async archiveUser(id: string, actorUserId?: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }

    if (PROTECTED_SYSTEM_EMAILS.has(user.email)) {
      throw new BadRequestException('Sistem yöneticisi arşivlenemez');
    }

    if (actorUserId && actorUserId === id) {
      throw new BadRequestException('Kendi hesabınızı arşivleyemezsiniz');
    }

    if (String(user.status).toLowerCase() === 'archived') {
      return { message: 'Kullanıcı zaten arşivde' };
    }

    const archivedAt = new Date();
    const archivedEmail = user.archivedEmail ?? user.email;

    await this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: archivedAt },
      });
      await tx.user.update({
        where: { id },
        data: {
          status: 'archived',
          archivedEmail,
          archivedAt,
          email: this.buildArchivedEmailPlaceholder(id),
        },
      });
    });

    this.auditLogsService.log({
      entityType: 'User',
      entityId: id,
      action: 'USER_ARCHIVED',
      oldValue: { email: user.email, status: user.status },
      newValue: { archivedEmail, status: 'archived' },
      userId: actorUserId ?? 'system',
    });

    return { message: 'Kullanıcı arşivlendi' };
  }

  async reactivateUser(id: string, actorUserId?: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }

    const status = String(user.status ?? '').toLowerCase();
    if (status !== 'archived' && status !== 'inactive') {
      throw new BadRequestException('Yalnızca arşiv veya pasif kullanıcı yeniden aktifleştirilebilir');
    }

    const restoreEmail = user.archivedEmail ?? user.email;
    const normalizedEmail = normalizeUserEmail(restoreEmail);

    const duplicate = await this.findActiveUserByMailbox(normalizedEmail, id);
    if (duplicate) {
      throw new BadRequestException('Bu e-posta adresi başka bir aktif kullanıcıda kayıtlı');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        status: 'active',
        email: normalizedEmail,
        archivedEmail: null,
        archivedAt: null,
      },
      include: {
        role: true,
        branch: true,
      },
    });

    this.auditLogsService.log({
      entityType: 'User',
      entityId: id,
      action: 'USER_REACTIVATED',
      oldValue: { status: user.status, archivedEmail: user.archivedEmail },
      newValue: { email: normalizedEmail, status: 'active' },
      userId: actorUserId ?? 'system',
    });

    const { passwordHash, ...safeUser } = updated;
    return safeUser;
  }

  async permanentDelete(id: string, actorUserId?: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }

    if (PROTECTED_SYSTEM_EMAILS.has(user.email) || PROTECTED_SYSTEM_EMAILS.has(user.archivedEmail ?? '')) {
      throw new BadRequestException('Sistem yöneticisi kalıcı olarak silinemez');
    }

    if (actorUserId && actorUserId === id) {
      throw new BadRequestException('Kendi hesabınızı kalıcı olarak silemezsiniz');
    }

    const status = String(user.status ?? '').toLowerCase();
    if (status !== 'archived') {
      throw new BadRequestException('Kalıcı silme yalnızca arşivlenmiş kullanıcılar için kullanılabilir');
    }

    const [
      fieldClaims,
      officeClaims,
      adjusterClaims,
      responsibleClaims,
    ] = await Promise.all([
      this.prisma.claimFile.count({ where: { assignedFieldUserId: id } }),
      this.prisma.claimFile.count({ where: { assignedOfficeUserId: id } }),
      this.prisma.claimFile.count({ where: { assignedAdjusterId: id } }),
      this.prisma.claimFile.count({ where: { currentResponsibleUserId: id } }),
    ]);

    const linkedClaims = fieldClaims + officeClaims + adjusterClaims + responsibleClaims;
    if (linkedClaims > 0) {
      throw new BadRequestException('Dosya ataması olan kullanıcı kalıcı olarak silinemez');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.screenPermission.deleteMany({ where: { userId: id } });
      await tx.userServiceArea.deleteMany({ where: { userId: id } });
      await tx.userDepartmentMembership.deleteMany({ where: { userId: id } });
      await tx.claimResponsibilityAssignment.deleteMany({ where: { userId: id } });
      await tx.userInsuranceCompanyScope.deleteMany({ where: { userId: id } });
      await tx.refreshToken.deleteMany({ where: { userId: id } });
      await tx.passwordResetToken.deleteMany({ where: { userId: id } });
      await tx.userEmailPreferences.deleteMany({ where: { userId: id } });
      await tx.user.delete({ where: { id } });
    });

    this.auditLogsService.log({
      entityType: 'User',
      entityId: id,
      action: 'USER_PERMANENTLY_DELETED',
      oldValue: { archivedEmail: user.archivedEmail ?? user.email },
      userId: actorUserId ?? 'system',
    });

    return { message: 'Kullanıcı kalıcı olarak silindi' };
  }

  async bulkDelete(ids: string[], actorUserId?: string) {
    const uniqueIds = [...new Set(ids.filter(Boolean))];
    if (uniqueIds.length === 0) {
      throw new BadRequestException('Silinecek kullanıcı seçilmedi');
    }

    if (actorUserId && uniqueIds.includes(actorUserId)) {
      throw new BadRequestException('Kendi hesabınızı toplu silme ile silemezsiniz');
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, email: true },
    });

    if (users.length !== uniqueIds.length) {
      throw new NotFoundException('Silinecek kullanıcılardan biri bulunamadı');
    }

    if (users.some((user) => PROTECTED_SYSTEM_EMAILS.has(user.email))) {
      throw new BadRequestException('Sistem yöneticisi toplu arşivleme ile arşivlenemez');
    }

    const archivedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      for (const user of users) {
        await tx.refreshToken.updateMany({
          where: { userId: user.id, revokedAt: null },
          data: { revokedAt: archivedAt },
        });
        await tx.user.update({
          where: { id: user.id },
          data: {
            status: 'archived',
            archivedEmail: user.email,
            archivedAt,
            email: this.buildArchivedEmailPlaceholder(user.id),
          },
        });
      }
    });

    this.auditLogsService.log({
      entityType: 'User',
      entityId: uniqueIds.join(','),
      action: 'BULK_ARCHIVE',
      oldValue: users,
      userId: actorUserId ?? '',
    });

    return {
      deletedCount: uniqueIds.length,
      ids: uniqueIds,
      message: `${uniqueIds.length} kullanıcı arşivlendi`,
    };
  }

  async saveExpoPushToken(userId: string, token: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı');

    await this.prisma.user.update({
      where: { id: userId },
      data: { expoPushToken: token || null },
    });

    return { message: 'Push token kaydedildi' };
  }

  async getServiceAreas(userId: string) {
    await this.findOne(userId);
    return this.prisma.userServiceArea.findMany({
      where: { userId },
      include: {
        province: { select: { id: true, name: true, plateCode: true } },
        district: { select: { id: true, name: true } },
      },
      orderBy: [{ province: { name: 'asc' } }],
    });
  }

  async updateServiceAreas(userId: string, serviceAreas: Array<{ provinceId: string; districtId?: string | null }>) {
    await this.findOne(userId);
    await this.prisma.userServiceArea.deleteMany({ where: { userId } });
    if (serviceAreas.length) {
      await this.prisma.userServiceArea.createMany({
        data: serviceAreas.map((sa) => ({
          userId,
          provinceId: sa.provinceId,
          districtId: sa.districtId ?? null,
        })),
        skipDuplicates: true,
      });
    }
    return this.getServiceAreas(userId);
  }

  // ── Ekran İzinleri ─────────────────────────────────────────────────────────

  async getMyPermissions(userId: string, roleCode: string): Promise<{ screens: string[] }> {
    const records = await this.prisma.screenPermission.findMany({
      where: { userId },
    });

    const defaults = getDefaultScreensForRole(roleCode);

    if (records.length === 0) {
      return { screens: defaults };
    }

    const dbMap = new Map(records.map((r) => [r.screenCode, r.canView]));
    const screens = ALL_SCREEN_CODES.filter((code) => {
      if (dbMap.has(code)) return dbMap.get(code) === true;
      return defaults.includes(code);
    }).map((code) => String(code));

    return { screens };
  }

  async getScreenPermissionsForUser(userId: string, roleCode: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı');

    const records = await this.prisma.screenPermission.findMany({ where: { userId } });
    const dbMap = new Map(records.map((r) => [r.screenCode, r]));
    const defaults = new Set(getDefaultScreensForRole(roleCode));

    return {
      screens: ALL_SCREEN_CODES.map((code) => {
        const rec = dbMap.get(code);
        const isDefault = defaults.has(code);
        if (rec) {
          return { code, label: SCREEN_LABELS[code] ?? code, canView: rec.canView, canEdit: rec.canEdit, isDefault };
        }
        return { code, label: SCREEN_LABELS[code] ?? code, canView: isDefault, canEdit: false, isDefault };
      }),
    };
  }

  async upsertScreenPermissions(userId: string, screens: Array<{ code: string; canView: boolean; canEdit?: boolean }>) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı');
    if (!screens || !Array.isArray(screens)) {
      return { message: 'Ekran izinleri güncellendi' };
    }

    await Promise.all(
      screens.map((s) =>
        this.prisma.screenPermission.upsert({
          where: { userId_screenCode: { userId, screenCode: s.code } },
          create: { userId, screenCode: s.code, canView: s.canView, canEdit: s.canEdit ?? false },
          update: { canView: s.canView, canEdit: s.canEdit ?? false },
        }),
      ),
    );

    return { message: 'Ekran izinleri güncellendi' };
  }

  async updateInsuranceCompanyScopes(userId: string, insuranceCompanyIds: string[]) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı');

    const normalizedIds = Array.isArray(insuranceCompanyIds) ? [...new Set(insuranceCompanyIds.filter(Boolean))] : [];

    await this.prisma.userInsuranceCompanyScope.deleteMany({ where: { userId } });

    if (normalizedIds.length > 0) {
      const companies = await this.prisma.insuranceCompany.findMany({
        where: { id: { in: normalizedIds } },
        select: { id: true },
      });
      const validIds = new Set(companies.map((company) => company.id));
      const missingIds = normalizedIds.filter((id) => !validIds.has(id));
      if (missingIds.length > 0) {
        throw new BadRequestException(`Geçersiz sigorta şirketi kimlikleri: ${missingIds.join(', ')}`);
      }

      await this.prisma.userInsuranceCompanyScope.createMany({
        data: normalizedIds.map((insuranceCompanyId) => ({ userId, insuranceCompanyId })),
        skipDuplicates: true,
      });
    }

    return {
      message: 'Sigorta şirketi kapsamları güncellendi',
      insuranceCompanyIds: normalizedIds,
    };
  }

  async updateAssistantCustomerScopes(userId: string, assistantCustomerIds: string[]) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı');

    const normalizedIds = Array.isArray(assistantCustomerIds)
      ? [...new Set(assistantCustomerIds.filter(Boolean))]
      : [];

    await this.prisma.userAssistantCustomerScope.deleteMany({ where: { userId } });

    if (normalizedIds.length > 0) {
      const customers = await this.prisma.customer.findMany({
        where: {
          id: { in: normalizedIds },
          entityType: 'corporate',
          subType: ASSISTANT_CUSTOMER_SUB_TYPE,
          status: 'active',
        },
        select: { id: true },
      });
      const validIds = new Set(customers.map((c) => c.id));
      const missingIds = normalizedIds.filter((id) => !validIds.has(id));
      if (missingIds.length > 0) {
        throw new BadRequestException(`Geçersiz asistans firması kimlikleri: ${missingIds.join(', ')}`);
      }

      await this.prisma.userAssistantCustomerScope.createMany({
        data: normalizedIds.map((customerId) => ({ userId, customerId })),
        skipDuplicates: true,
      });
    }

    return {
      message: 'Asistans firma kapsamları güncellendi',
      assistantCustomerIds: normalizedIds,
    };
  }
}
