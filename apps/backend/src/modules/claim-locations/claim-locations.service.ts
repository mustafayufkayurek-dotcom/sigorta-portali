import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateClaimLocationDto } from './dto/create-claim-location.dto';
import { UpdateClaimLocationDto } from './dto/update-claim-location.dto';
import { BindClaimLocationDto } from './dto/bind-claim-location.dto';

@Injectable()
export class ClaimLocationsService {
  constructor(private prisma: PrismaService) {}

  async findAll(status?: string) {
    return this.prisma.claimLocation.findMany({
      where: {
        parentId: null,
        ...(status ? { status } : {}),
      },
      include: {
        _count: { select: { children: true } },
        category: { select: { id: true, code: true, name: true } },
        children: {
          where: { status: 'active' },
          select: { id: true, name: true, status: true },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async catalogForReport() {
    const parents = await this.prisma.claimLocation.findMany({
      where: { parentId: null, status: 'active' },
      include: {
        category: { select: { code: true } },
        children: {
          where: { status: 'active' },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return parents.flatMap((parent) => {
      const categoryCode = (parent.category?.code ?? 'bina').toLowerCase();
      if (parent.children.length === 0) {
        return [{ categoryCode, label: parent.name }];
      }
      return parent.children.map((child) => ({
        categoryCode,
        label: `${parent.name} - ${child.name}`,
      }));
    });
  }

  async findSubLocations(parentId: string, status?: string) {
    const parent = await this.prisma.claimLocation.findUnique({ where: { id: parentId } });
    if (!parent) throw new NotFoundException('Mahal bulunamadı');
    return this.prisma.claimLocation.findMany({
      where: {
        parentId,
        ...(status ? { status } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async bind(dto: BindClaimLocationDto) {
    const mahalName = dto.mahalName.trim();
    const bolgeName = dto.bolgeName?.trim() || '';
    if (!mahalName) throw new BadRequestException('Mahal adı zorunludur');
    const requestedIds = (dto.categoryIds ?? []).map((id) => id.trim()).filter(Boolean);
    if (dto.categoryId) requestedIds.push(dto.categoryId);
    const uniqueIds = Array.from(new Set(requestedIds));
    if (!dto.allCategories && uniqueIds.length === 0) {
      throw new BadRequestException('Kategori seçin');
    }
    const categories = dto.allCategories
      ? await this.prisma.repairDamageCategory.findMany({
          where: { status: 'active' },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        })
      : (
          await this.prisma.repairDamageCategory.findMany({
            where: { id: { in: uniqueIds }, status: 'active' },
          })
        ).sort((a, b) => uniqueIds.indexOf(a.id) - uniqueIds.indexOf(b.id));
    if (categories.length === 0) throw new NotFoundException('Kategori bulunamadı');

    try {
      const bound = [];
      for (const category of categories) {
        const parent = await this.ensureParentMahal(mahalName, category.id, category.code);
        if (bolgeName) {
          await this.ensureChildBolge(parent.id, bolgeName, category.code);
        }
        bound.push({ categoryId: category.id, mahalId: parent.id });
      }
      return { bound };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Kayıt yapılamadı';
      throw new BadRequestException(msg.includes('Unique') || msg.includes('unique') ? 'Bu mahal zaten kayıtlı' : 'Mahal bağlanamadı. Tekrar deneyin.');
    }
  }

  private nameMatch(name: string) {
    return { equals: name };
  }

  private async ensureParentMahal(name: string, categoryId: string, categoryCode: string) {
    const existing = await this.prisma.claimLocation.findFirst({
      where: { parentId: null, categoryId, name: this.nameMatch(name) },
    });
    if (existing) return existing;
    const unbound = await this.prisma.claimLocation.findFirst({
      where: { parentId: null, categoryId: null, name: this.nameMatch(name) },
    });
    if (unbound) {
      return this.prisma.claimLocation.update({ where: { id: unbound.id }, data: { categoryId } });
    }
    const code = await this.uniqueLocationCode('MAHAL', name, categoryCode);
    return this.prisma.claimLocation.create({
      data: { code, name, parentId: null, categoryId, sortOrder: 0 },
    });
  }

  private async ensureChildBolge(parentId: string, name: string, categoryCode: string) {
    const existing = await this.prisma.claimLocation.findFirst({
      where: { parentId, name: this.nameMatch(name) },
    });
    if (existing) return existing;
    const parent = await this.prisma.claimLocation.findUnique({ where: { id: parentId } });
    const code = await this.uniqueLocationCode('BOLGE', name, categoryCode);
    return this.prisma.claimLocation.create({
      data: {
        code,
        name,
        parentId,
        categoryId: parent?.categoryId ?? null,
        sortOrder: 0,
      },
    });
  }

  private async uniqueLocationCode(prefix: string, name: string, categoryCode: string) {
    const slug = (raw: string) =>
      raw
        .trim()
        .toUpperCase()
        .replace(/Ç/g, 'C')
        .replace(/Ğ/g, 'G')
        .replace(/İ/g, 'I')
        .replace(/I/g, 'I')
        .replace(/Ö/g, 'O')
        .replace(/Ş/g, 'S')
        .replace(/Ü/g, 'U')
        .replace(/[^A-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .replace(/_+/g, '_')
        .slice(0, 18);
    const base = `${prefix}_${slug(name)}_${slug(categoryCode)}`.replace(/_+/g, '_').slice(0, 46);
    let code = base || `${prefix}_${Date.now()}`;
    let n = 2;
    while (await this.prisma.claimLocation.findUnique({ where: { code } })) {
      code = `${base}_${n++}`.slice(0, 50);
    }
    return code;
  }

  async create(dto: CreateClaimLocationDto) {
    const code = dto.code.toUpperCase().replace(/\s+/g, '_');
    const existing = await this.prisma.claimLocation.findUnique({ where: { code } });
    if (existing) throw new ConflictException(`"${code}" kodu zaten kullanımda`);
    const nameConflict = await this.prisma.claimLocation.findFirst({
      where: { name: dto.name, parentId: dto.parentId ?? null, categoryId: dto.categoryId ?? null },
    });
    if (nameConflict) throw new ConflictException('Bu isimde bir mahal zaten mevcut');
    if (dto.categoryId) {
      const category = await this.prisma.repairDamageCategory.findUnique({ where: { id: dto.categoryId } });
      if (!category) throw new NotFoundException('Kategori bulunamadı');
    }
    return this.prisma.claimLocation.create({
      data: {
        code,
        name: dto.name,
        description: dto.description,
        sortOrder: dto.sortOrder ?? 0,
        parentId: dto.parentId ?? null,
        categoryId: dto.categoryId ?? null,
      },
    });
  }

  async createSubLocation(parentId: string, dto: CreateClaimLocationDto) {
    const parent = await this.prisma.claimLocation.findUnique({ where: { id: parentId } });
    if (!parent) throw new NotFoundException('Üst mahal bulunamadı');
    const code = dto.code.toUpperCase().replace(/\s+/g, '_');
    const existing = await this.prisma.claimLocation.findUnique({ where: { code } });
    if (existing) throw new ConflictException(`"${code}" kodu zaten kullanımda`);
    const nameConflict = await this.prisma.claimLocation.findFirst({
      where: { name: dto.name, parentId },
    });
    if (nameConflict) throw new ConflictException('Bu isimde bir alt mahal zaten mevcut');
    return this.prisma.claimLocation.create({
      data: {
        code,
        name: dto.name,
        description: dto.description,
        sortOrder: dto.sortOrder ?? 0,
        parentId,
        categoryId: parent.categoryId,
      },
    });
  }

  async update(id: string, dto: UpdateClaimLocationDto) {
    const loc = await this.prisma.claimLocation.findUnique({ where: { id } });
    if (!loc) throw new NotFoundException('Mahal bulunamadı');
    if (dto.name && dto.name !== loc.name) {
      const nameConflict = await this.prisma.claimLocation.findFirst({
        where: {
          name: dto.name,
          parentId: loc.parentId,
          categoryId: dto.categoryId ?? loc.categoryId,
          NOT: { id },
        },
      });
      if (nameConflict) throw new ConflictException('Bu isimde bir mahal zaten mevcut');
    }
    if (dto.categoryId) {
      const category = await this.prisma.repairDamageCategory.findUnique({ where: { id: dto.categoryId } });
      if (!category) throw new NotFoundException('Kategori bulunamadı');
    }
    return this.prisma.claimLocation.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const loc = await this.prisma.claimLocation.findUnique({ where: { id } });
    if (!loc) throw new NotFoundException('Mahal bulunamadı');
    await this.prisma.claimLocation.delete({ where: { id } });
    return { message: 'Mahal silindi' };
  }
}
