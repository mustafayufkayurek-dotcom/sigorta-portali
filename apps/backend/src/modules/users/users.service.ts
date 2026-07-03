import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditLogsService } from '@/modules/audit-logs/audit-logs.service';
import { EmailService } from '@/modules/notifications/email/email.service';
import { buildAppPath } from '@/common/utils/app-url';
import { applyTitleCase } from '@/common/utils/text-helpers';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';
import { ALL_SCREEN_CODES, SCREEN_LABELS, getDefaultScreensForRole } from './screen-permissions.defaults';

function normalizeUserEmail(email: string): string {
  return String(email ?? '').trim().toLowerCase();
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

    return {
      data: data.map((u) => {
        const { passwordHash, ...user } = u;
        return user;
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

    const { password, departmentMemberships, responsibilityAssignments, serviceAreas, insuranceCompanyIds, ...rest } = data;
    await this.validateNestedUserRelations(departmentMemberships, responsibilityAssignments);
    const temporaryPassword = typeof password === 'string' && password.trim().length > 0
      ? password.trim()
      : generateTemporaryPassword();
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          ...rest,
          email: normalizedEmail,
          passwordHash: hashedPassword,
          mustChangePassword: true,
          temporaryPasswordIssuedAt: new Date(),
          status: rest.status ?? 'active',
        },
        include: {
          role: true,
          branch: true,
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

      return createdUser;
    });

    const { passwordHash, ...result } = user;
    const welcomeEmail = await this.sendWelcomeInviteEmail({
      email: normalizedEmail,
      firstName: result.firstName,
      lastName: result.lastName,
      temporaryPassword,
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
      ...rest
    } = data;

    const restoreEmail = normalizeUserEmail(
      existingUser.archivedEmail ?? existingUser.email ?? data.email,
    );

    const activeConflict = await this.findActiveUserByMailbox(restoreEmail, existingUser.id);
    if (activeConflict) {
      throw new BadRequestException('Bu e-posta adresi başka bir aktif kullanıcıda kayıtlı');
    }

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

    const welcomeEmail = await this.sendWelcomeInviteEmail({
      email: restoreEmail,
      firstName: reactivated.firstName,
      lastName: reactivated.lastName,
      temporaryPassword,
    });

    return {
      ...reactivated,
      temporaryPassword,
      welcomeEmail,
      reinvited: true,
    };
  }

  private async sendWelcomeInviteEmail(params: {
    email: string;
    firstName: string;
    lastName: string;
    temporaryPassword: string;
  }): Promise<{ sent: boolean; message: string }> {
    const loginUrl = buildAppPath(this.config, '/giris');
    const fullName = `${params.firstName} ${params.lastName}`.trim();

    const result = await this.emailService.sendWelcomeInviteEmail(params.email, {
      fullName,
      email: params.email,
      temporaryPassword: params.temporaryPassword,
      loginUrl: loginUrl,
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
      ...rest
    } = data;
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
      Array.isArray(insuranceCompanyIds);

    const include = {
      role: true,
      branch: true,
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

    const updated = roleChanged || hasNestedUpdates
      ? await this.prisma.$transaction(async (tx) => {
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

    if (records.length > 0) {
      const screens = records.filter((r) => r.canView).map((r) => r.screenCode);
      return { screens };
    }

    // Kayıt yoksa role default döndür
    return { screens: getDefaultScreensForRole(roleCode) };
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
}
