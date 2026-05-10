import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

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
}
