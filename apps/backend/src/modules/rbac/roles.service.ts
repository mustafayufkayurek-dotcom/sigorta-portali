import { Injectable, NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import {
  CAPABILITY_GROUPS,
  capabilityIdsFromPermissionCodes,
  expandCapabilityIds,
  isManagedPermissionCode,
} from './role-capabilities';

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  getCapabilityCatalog() {
    return CAPABILITY_GROUPS.map((g) => ({
      id: g.id,
      title: g.title,
      capabilities: g.capabilities.map((c) => ({ id: c.id, label: c.label })),
    }));
  }

  async findAll() {
    return this.prisma.role.findMany({
      include: {
        rolePermissions: {
          include: { permission: true },
        },
        _count: { select: { users: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        rolePermissions: {
          include: { permission: true },
        },
        _count: { select: { users: true } },
      },
    });
    if (!role) throw new NotFoundException('Rol bulunamadı');
    return role;
  }

  async create(dto: CreateRoleDto) {
    const existing = await this.prisma.role.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException('Bu kod zaten kullanılıyor');

    return this.prisma.role.create({
      data: {
        name: dto.name,
        code: dto.code.toUpperCase(),
        description: dto.description,
      },
    });
  }

  async update(id: string, dto: UpdateRoleDto) {
    await this.findOne(id);

    if (dto.code) {
      const existing = await this.prisma.role.findFirst({
        where: { code: dto.code, id: { not: id } },
      });
      if (existing) throw new ConflictException('Bu kod zaten kullanılıyor');
    }

    return this.prisma.role.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.code && { code: dto.code.toUpperCase() }),
        ...(dto.description !== undefined && { description: dto.description }),
      },
    });
  }

  async remove(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!role) throw new NotFoundException('Rol bulunamadı');

    if (role._count.users > 0) {
      throw new BadRequestException(
        `Bu role ${role._count.users} kullanıcı atanmış. Silmeden önce kullanıcıları başka bir role taşıyın.`,
      );
    }

    await this.prisma.rolePermission.deleteMany({ where: { roleId: id } });
    return this.prisma.role.delete({ where: { id } });
  }

  async getCapabilityIdsForRole(id: string): Promise<string[]> {
    const role = await this.findOne(id);
    const codes = role.rolePermissions.map((rp) => rp.permission.code);
    return capabilityIdsFromPermissionCodes(codes);
  }

  /**
   * Whitelist yetenekleri senkronlar; yönetilmeyen izinlere dokunmaz.
   * Admin rolü değiştirilemez.
   */
  async setCapabilities(id: string, capabilityIds: string[]) {
    const role = await this.findOne(id);
    const code = String(role.code || '').toLowerCase();
    if (code === 'admin' || code === 'super_admin') {
      throw new ForbiddenException('Yönetici rolünün yetkileri bu ekrandan değiştirilemez.');
    }

    const knownIds = new Set(
      CAPABILITY_GROUPS.flatMap((g) => g.capabilities.map((c) => c.id)),
    );
    const unknown = capabilityIds.filter((cid) => !knownIds.has(cid));
    if (unknown.length > 0) {
      throw new BadRequestException('Geçersiz yetenek seçimi.');
    }

    const desiredManaged = new Set(expandCapabilityIds(capabilityIds));
    const currentCodes = role.rolePermissions.map((rp) => rp.permission.code);
    const unmanaged = currentCodes.filter((c) => !isManagedPermissionCode(c));

    const permissions = await this.prisma.permission.findMany({
      where: { code: { in: [...desiredManaged] } },
    });
    if (permissions.length !== desiredManaged.size) {
      throw new BadRequestException('Bazı işlem izinleri sistemde tanımlı değil. Yöneticiye bildirin.');
    }

    const managedCurrent = role.rolePermissions.filter((rp) =>
      isManagedPermissionCode(rp.permission.code),
    );
    const toRemove = managedCurrent.filter((rp) => !desiredManaged.has(rp.permission.code));

    await this.prisma.$transaction(async (tx) => {
      if (toRemove.length > 0) {
        await tx.rolePermission.deleteMany({
          where: {
            roleId: id,
            permissionId: { in: toRemove.map((rp) => rp.permissionId) },
          },
        });
      }
      for (const perm of permissions) {
        await tx.rolePermission.upsert({
          where: {
            roleId_permissionId: { roleId: id, permissionId: perm.id },
          },
          update: {},
          create: { roleId: id, permissionId: perm.id },
        });
      }
    });

    const updated = await this.findOne(id);
    return {
      role: updated,
      capabilityIds: capabilityIdsFromPermissionCodes(
        updated.rolePermissions.map((rp) => rp.permission.code),
      ),
      /** Yönetilmeyen izinler korundu (sayı) */
      preservedOtherCount: unmanaged.length,
    };
  }
}
