import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CacheService } from '@/cache/cache.service';

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  async findAll(params?: {
    page?: number;
    limit?: number;
    claimFileId?: string;
    assignedUserId?: string;
    status?: string;
  }) {
    const page = Number(params?.page) || 1;
    const limit = Number(params?.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params?.claimFileId) where.claimFileId = params.claimFileId;
    if (params?.assignedUserId) where.assignedUserId = params.assignedUserId;
    if (params?.status) where.status = params.status;

    const [data, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        skip,
        take: limit,
        include: {
          assignedUser: { select: { id: true, firstName: true, lastName: true } },
          checklists: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.task.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        assignedUser: { select: { id: true, firstName: true, lastName: true } },
        checklists: true,
        claimFile: { select: { id: true, fileNo: true } },
      },
    });
    if (!task) {
      throw new NotFoundException('Görev bulunamadı');
    }
    return task;
  }

  async create(data: any) {
    const created = await this.prisma.task.create({
      data,
      include: {
        assignedUser: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    this.cache.invalidatePattern('cache:dashboard:*').catch(() => {});
    return created;
  }

  async update(id: string, data: any) {
    await this.findOne(id);
    const updated = await this.prisma.task.update({
      where: { id },
      data,
      include: {
        assignedUser: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    this.cache.invalidatePattern('cache:dashboard:*').catch(() => {});
    return updated;
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.task.delete({ where: { id } });
    return { message: 'Görev silindi' };
  }

  async complete(id: string) {
    await this.findOne(id);
    const completed = await this.prisma.task.update({
      where: { id },
      data: { status: 'completed', completedAt: new Date() },
    });
    this.cache.invalidatePattern('cache:dashboard:*').catch(() => {});
    return completed;
  }
}
