import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateWorkSubGroupDto } from './dto/create-work-sub-group.dto';
import { UpdateWorkSubGroupDto } from './dto/update-work-sub-group.dto';

@Injectable()
export class WorkSubGroupsService {
  constructor(private prisma: PrismaService) {}

  async create(workGroupId: string, dto: CreateWorkSubGroupDto) {
    const wg = await this.prisma.workGroup.findUnique({ where: { id: workGroupId } });
    if (!wg) throw new NotFoundException('İş grubu bulunamadı');

    const code = dto.code.toUpperCase().replace(/\s+/g, '_');
    const existing = await this.prisma.workSubGroup.findUnique({ where: { code } });
    if (existing) throw new ConflictException(`"${code}" kodu zaten kullanımda`);

    const nameConflict = await this.prisma.workSubGroup.findFirst({
      where: { name: dto.name, workGroupId },
    });
    if (nameConflict) throw new ConflictException('Bu isimde bir alt grup zaten mevcut');

    return this.prisma.workSubGroup.create({
      data: {
        workGroupId,
        code,
        name: dto.name,
        description: dto.description,
        unitType: dto.unitType,
        unitPrice: dto.unitPrice !== undefined ? dto.unitPrice : undefined,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async update(id: string, dto: UpdateWorkSubGroupDto) {
    const sub = await this.prisma.workSubGroup.findUnique({ where: { id } });
    if (!sub) throw new NotFoundException('Alt grup bulunamadı');
    if (dto.name && dto.name !== sub.name) {
      const nameConflict = await this.prisma.workSubGroup.findFirst({
        where: { name: dto.name, workGroupId: sub.workGroupId, NOT: { id } },
      });
      if (nameConflict) throw new ConflictException('Bu isimde bir alt grup zaten mevcut');
    }
    return this.prisma.workSubGroup.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        unitType: dto.unitType,
        unitPrice: dto.unitPrice !== undefined ? dto.unitPrice : undefined,
        sortOrder: dto.sortOrder,
        status: dto.status,
      },
    });
  }

  async remove(id: string) {
    const sub = await this.prisma.workSubGroup.findUnique({ where: { id } });
    if (!sub) throw new NotFoundException('Alt grup bulunamadı');
    await this.prisma.workSubGroup.delete({ where: { id } });
    return { message: 'Alt grup silindi' };
  }
}
