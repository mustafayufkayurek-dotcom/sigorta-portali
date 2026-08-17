import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateAssignmentRuleDto, UpdateAssignmentRuleDto } from './dto/assignment-rules.dto';

@Injectable()
export class AssignmentRulesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.assignmentRule.findMany({
      include: {
        assignToUser: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { priority: 'desc' },
    });
  }

  async create(dto: CreateAssignmentRuleDto) {
    return this.prisma.assignmentRule.create({
      data: {
        name: dto.name,
        workGroupId: dto.workGroupId,
        serviceRegionId: dto.serviceRegionId,
        assignToUserId: dto.assignToUserId,
        priority: dto.priority ?? 0,
        isActive: dto.isActive ?? true,
      },
      include: {
        assignToUser: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async update(id: string, dto: UpdateAssignmentRuleDto) {
    const rule = await this.prisma.assignmentRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException('Atama kuralı bulunamadı');

    return this.prisma.assignmentRule.update({
      where: { id },
      data: {
        name: dto.name,
        workGroupId: dto.workGroupId,
        serviceRegionId: dto.serviceRegionId,
        assignToUserId: dto.assignToUserId,
        priority: dto.priority,
        isActive: dto.isActive,
      },
      include: {
        assignToUser: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async remove(id: string) {
    const rule = await this.prisma.assignmentRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException('Atama kuralı bulunamadı');
    await this.prisma.assignmentRule.delete({ where: { id } });
    return { message: 'Atama kuralı silindi' };
  }
}
