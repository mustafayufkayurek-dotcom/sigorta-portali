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

    const { password, ...rest } = data;
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await this.prisma.user.create({
      data: {
        ...rest,
        passwordHash: hashedPassword,
      },
      include: {
        role: true,
        branch: true,
      },
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

    const updated = await this.prisma.user.update({
      where: { id },
      data,
      include: {
        role: true,
        branch: true,
      },
    });

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

    const { passwordHash, ...result } = updated;
    return result;
  }

  async remove(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }

    if (user.email === 'admin@example.com') {
      throw new BadRequestException('Sistem yöneticisi silinemez');
    }

    await this.prisma.user.delete({ where: { id } });
    return { message: 'Kullanıcı silindi' };
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
}
