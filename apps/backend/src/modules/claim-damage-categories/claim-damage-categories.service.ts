import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateClaimDamageCategoryDto } from './dto/create-claim-damage-category.dto';
import { UpdateClaimDamageCategoryDto } from './dto/update-claim-damage-category.dto';

function normalizeCategoryCode(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '_');
}

@Injectable()
export class ClaimDamageCategoriesService {
  constructor(private prisma: PrismaService) {}

  async findAll(status?: string) {
    return this.prisma.repairDamageCategory.findMany({
      where: status ? { status } : {},
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async create(dto: CreateClaimDamageCategoryDto) {
    const code = normalizeCategoryCode(dto.code?.trim() || dto.name);
    const existing = await this.prisma.repairDamageCategory.findUnique({ where: { code } });
    if (existing) throw new ConflictException(`"${code}" kodu zaten kullanımda`);
    const nameConflict = await this.prisma.repairDamageCategory.findFirst({
      where: { name: dto.name },
    });
    if (nameConflict) throw new ConflictException('Bu isimde bir kategori zaten mevcut');
    return this.prisma.repairDamageCategory.create({
      data: {
        code,
        name: dto.name,
        description: dto.description,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async update(id: string, dto: UpdateClaimDamageCategoryDto) {
    const row = await this.prisma.repairDamageCategory.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Kategori bulunamadı');
    const data: {
      code?: string;
      name?: string;
      description?: string;
      sortOrder?: number;
      status?: string;
    } = {};
    if (dto.code != null) {
      const code = normalizeCategoryCode(dto.code);
      if (code !== row.code) {
        const existing = await this.prisma.repairDamageCategory.findUnique({ where: { code } });
        if (existing) throw new ConflictException(`"${code}" kodu zaten kullanımda`);
      }
      data.code = code;
    }
    if (dto.name && dto.name !== row.name) {
      const nameConflict = await this.prisma.repairDamageCategory.findFirst({
        where: { name: dto.name, NOT: { id } },
      });
      if (nameConflict) throw new ConflictException('Bu isimde bir kategori zaten mevcut');
      data.name = dto.name;
    }
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.status !== undefined) data.status = dto.status;
    return this.prisma.repairDamageCategory.update({ where: { id }, data });
  }

  async remove(id: string) {
    const row = await this.prisma.repairDamageCategory.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Kategori bulunamadı');
    await this.prisma.repairDamageCategory.delete({ where: { id } });
    return { message: 'Kategori silindi' };
  }
}
