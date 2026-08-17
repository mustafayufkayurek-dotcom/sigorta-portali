import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateClaimSubjectDto, UpdateClaimSubjectDto } from './dto/claim-subjects.dto';

@Injectable()
export class ClaimSubjectsService {
  constructor(private prisma: PrismaService) {}

  async findAll(category?: string) {
    const where: any = {};
    if (category) where.category = category;
    return this.prisma.claimSubject.findMany({
      where,
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  async findActive(category?: string) {
    const where: any = { isActive: true };
    if (category) where.category = category;
    return this.prisma.claimSubject.findMany({
      where,
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  async findOne(id: string) {
    const subject = await this.prisma.claimSubject.findUnique({
      where: { id },
      include: {
        _count: { select: { claimFiles: true } },
      },
    });
    if (!subject) throw new NotFoundException('İhbar konusu bulunamadı');
    return subject;
  }

  async create(dto: CreateClaimSubjectDto) {
    const existing = await this.prisma.claimSubject.findUnique({ where: { code: dto.code } });
    if (existing) throw new BadRequestException('Bu kod zaten kullanımda');
    const nameConflict = await this.prisma.claimSubject.findFirst({ where: { name: dto.name } });
    if (nameConflict) throw new ConflictException('Bu isimde bir ihbar konusu zaten mevcut');
    return this.prisma.claimSubject.create({ data: dto });
  }

  async update(id: string, dto: UpdateClaimSubjectDto) {
    await this.findOne(id);
    if (dto.code) {
      const conflict = await this.prisma.claimSubject.findUnique({
        where: { code: dto.code, NOT: { id } },
      });
      if (conflict) throw new BadRequestException('Bu kod zaten kullanımda');
    }
    if (dto.name) {
      const nameConflict = await this.prisma.claimSubject.findFirst({
        where: { name: dto.name, NOT: { id } },
      });
      if (nameConflict) throw new ConflictException('Bu isimde bir ihbar konusu zaten mevcut');
    }
    return this.prisma.claimSubject.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    const fileCount = await this.prisma.claimFile.count({ where: { claimSubjectId: id } });
    if (fileCount > 0) {
      throw new BadRequestException('Bu ihbar konusu dosyalarda kullanılıyor, silinemez');
    }
    await this.prisma.claimSubject.delete({ where: { id } });
    return { success: true };
  }
}
