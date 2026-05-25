import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditLogsService } from '@/modules/audit-logs/audit-logs.service';
import { applyTitleCase } from '@/common/utils/text-helpers';
import * as bcrypt from 'bcrypt';
import { ALL_SCREEN_CODES, SCREEN_LABELS, getDefaultScreensForRole } from './screen-permissions.defaults';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async findAll(params?: { page?: number; limit?: number; roleId?: string; branchId?: string }) {
    const page = parseInt(String(params?.page || 1), 10);
    const limit = parseInt(String(params?.limit || 20), 10);
    const skip = (page - 1) * limit;

    const where: any = {};
    if ((params as any)?.includeInactive !== 'true') {
      where.status = { notIn: ['inactive', 'INACTIVE'] };
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
    const existingUser = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new BadRequestException('Bu e-posta adresi zaten kullanılıyor');
    }

    applyTitleCase(data, ['firstName', 'lastName']);

    const { password, departmentMemberships, responsibilityAssignments, serviceAreas, insuranceCompanyIds, ...rest } = data;
    if (!password) {
      throw new BadRequestException('Şifre zorunludur');
    }
    await this.validateNestedUserRelations(departmentMemberships, responsibilityAssignments);
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          ...rest,
          passwordHash: hashedPassword,
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
    return result;
  }

  async update(id: string, data: any) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }

    if (user.email === 'admin@example.com') {
      throw new BadRequestException('Sistem yöneticisi düzenlenemez');
    }

    applyTitleCase(data, ['firstName', 'lastName']);

    if (data.password) {
      data.passwordHash = await bcrypt.hash(data.password, 10);
      delete data.password;
    }

    const roleChanged = data.roleId !== undefined && data.roleId !== user.roleId;
    const updateArgs: any = {
      where: { id },
      data,
      include: {
        role: true,
        branch: true,
      },
    };

    const updated = roleChanged
      ? await this.prisma.$transaction(async (tx) => {
          await tx.screenPermission.deleteMany({ where: { userId: id } });
          await tx.userServiceArea.deleteMany({ where: { userId: id } });
          await tx.userDepartmentMembership.deleteMany({ where: { userId: id } });
          await tx.claimResponsibilityAssignment.deleteMany({ where: { userId: id } });

          this.auditLogsService.log({
            entityType: 'User',
            entityId: id,
            action: 'ROLE_SWITCH_CLEANUP',
            oldValue: { roleId: user.roleId },
            newValue: { roleId: data.roleId },
            userId: id,
            userEmail: user.email,
          });

          return tx.user.update(updateArgs);
        })
      : await this.prisma.user.update(updateArgs);

    if (data.roleId !== undefined || data.status !== undefined) {
      this.auditLogsService.log({
        entityType: 'User',
        entityId: id,
        action: 'UPDATE',
        oldValue: { roleId: user.roleId, status: user.status },
        newValue: { roleId: updated.roleId, status: updated.status },
        userId: id,
        userEmail: updated.email,
      });
    }

    const finalUpdated = updated ?? await this.prisma.user.findUnique({ where: { id } });
    if (!finalUpdated) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }

    const { passwordHash, ...result } = finalUpdated;
    return result;
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

  async remove(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }

    if (user.email === 'admin@example.com') {
      throw new BadRequestException('Sistem yöneticisi silinemez');
    }

    await this.prisma.user.update({
      where: { id },
      data: { status: 'inactive' },
    });
    return { message: 'Kullanıcı pasifleştirildi' };
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

    if (users.some((user) => user.email === 'admin@example.com')) {
      throw new BadRequestException('Sistem yöneticisi toplu silme ile silinemez');
    }

    await this.prisma.user.updateMany({
      where: { id: { in: uniqueIds } },
      data: { status: 'inactive' },
    });

    this.auditLogsService.log({
      entityType: 'User',
      entityId: uniqueIds.join(','),
      action: 'BULK_DEACTIVATE',
      oldValue: users,
      userId: actorUserId ?? '',
    });

    return {
      deletedCount: uniqueIds.length,
      ids: uniqueIds,
      message: `${uniqueIds.length} kullanıcı pasifleştirildi`,
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
