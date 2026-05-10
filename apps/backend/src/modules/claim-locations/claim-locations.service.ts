import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateClaimLocationDto } from './dto/create-claim-location.dto';
import { UpdateClaimLocationDto } from './dto/update-claim-location.dto';

@Injectable()
export class ClaimLocationsService {
  constructor(private prisma: PrismaService) {}

  async findAll(status?: string) {
    return this.prisma.claimLocation.findMany({
      where: {
        parentId: null,
        ...(status ? { status } : {}),
      },
      include: { _count: { select: { children: true } } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
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

  async create(dto: CreateClaimLocationDto) {
    const code = dto.code.toUpperCase().replace(/\s+/g, '_');
    const existing = await this.prisma.claimLocation.findUnique({ where: { code } });
    if (existing) throw new ConflictException(`"${code}" kodu zaten kullanımda`);
    const nameConflict = await this.prisma.claimLocation.findFirst({
      where: { name: dto.name, parentId: dto.parentId ?? null },
    });
    if (nameConflict) throw new ConflictException('Bu isimde bir mahal zaten mevcut');
    return this.prisma.claimLocation.create({
      data: {
        code,
        name: dto.name,
        description: dto.description,
        sortOrder: dto.sortOrder ?? 0,
        parentId: dto.parentId ?? null,
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
      },
    });
  }

  async update(id: string, dto: UpdateClaimLocationDto) {
    const loc = await this.prisma.claimLocation.findUnique({ where: { id } });
    if (!loc) throw new NotFoundException('Mahal bulunamadı');
    if (dto.name && dto.name !== loc.name) {
      const nameConflict = await this.prisma.claimLocation.findFirst({
        where: { name: dto.name, parentId: loc.parentId, NOT: { id } },
      });
      if (nameConflict) throw new ConflictException('Bu isimde bir mahal zaten mevcut');
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
