import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateExtraWorkItemDto } from './dto/create-extra-work-item.dto';
import { UpdateExtraWorkItemDto } from './dto/update-extra-work-item.dto';

type ExtraWorkItemWithRelations = Awaited<ReturnType<ExtraWorkItemService['findOne']>>;

@Injectable()
export class ExtraWorkItemService {
  constructor(private readonly prisma: PrismaService) {}

  async create(claimFileId: string, dto: CreateExtraWorkItemDto, userId: string) {
    await this.assertClaimFileExists(claimFileId);

    return this.prisma.extraWorkItem.create({
      data: {
        claimFileId,
        title: dto.title,
        description: dto.description,
        agreedAt: dto.agreedAt ? new Date(dto.agreedAt) : null,
        createdByUserId: userId,
        status: 'draft',
      },
      include: { revenues: true, costEntries: true },
    });
  }

  async findAll(claimFileId: string) {
    await this.assertClaimFileExists(claimFileId);

    return this.prisma.extraWorkItem.findMany({
      where: { claimFileId },
      include: {
        revenues: {
          select: { id: true, revenueType: true, totalAmount: true, status: true, collectionSource: true },
        },
        costEntries: {
          select: { id: true, amount: true, description: true, expenseCategoryId: true },
        },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(claimFileId: string, id: string) {
    const item = await this.prisma.extraWorkItem.findFirst({
      where: { id, claimFileId },
      include: {
        revenues: true,
        costEntries: {
          include: { expenseCategory: { select: { id: true, name: true, code: true } } },
        },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (!item) {
      throw new NotFoundException(`ExtraWorkItem ${id} bulunamadı`);
    }

    return item;
  }

  async update(claimFileId: string, id: string, dto: UpdateExtraWorkItemDto) {
    await this.findOne(claimFileId, id);

    return this.prisma.extraWorkItem.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.agreedAt !== undefined && { agreedAt: new Date(dto.agreedAt) }),
        ...(dto.completedAt !== undefined && { completedAt: new Date(dto.completedAt) }),
      },
    });
  }

  async remove(claimFileId: string, id: string) {
    const item = await this.findOne(claimFileId, id);

    if (item.status !== 'draft') {
      throw new BadRequestException(
        `Sadece taslak ekstra işler silinebilir. Mevcut durum: ${item.status}`,
      );
    }

    return this.prisma.extraWorkItem.delete({ where: { id } });
  }

  async getMiniPL(claimFileId: string, id: string) {
    const item = await this.findOne(claimFileId, id);
    return this.computeMiniPL(item);
  }

  computeMiniPL(item: ExtraWorkItemWithRelations) {
    const totalRevenue = item.revenues
      .filter((r) => r.status !== 'cancelled')
      .reduce((sum, r) => sum + r.totalAmount, 0);

    const totalCost = item.costEntries.reduce((sum, c) => sum + c.amount, 0);

    const netProfit = totalRevenue - totalCost;
    const netMarginPct = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    return {
      id: item.id,
      title: item.title,
      status: item.status,
      totalRevenue,
      totalCost,
      netProfit,
      netMarginPct: Math.round(netMarginPct * 100) / 100,
      revenueBreakdown: item.revenues
        .filter((r) => r.status !== 'cancelled')
        .map((r) => ({
          id: r.id,
          totalAmount: r.totalAmount,
          collectionSource: r.collectionSource,
          status: r.status,
        })),
      costBreakdown: item.costEntries.map((c) => ({
        id: c.id,
        amount: c.amount,
        description: c.description,
        category: (c as any).expenseCategory?.name ?? c.expenseCategoryId,
      })),
    };
  }

  private async assertClaimFileExists(claimFileId: string): Promise<void> {
    const cf = await this.prisma.claimFile.findUnique({
      where: { id: claimFileId },
      select: { id: true },
    });
    if (!cf) throw new NotFoundException(`ClaimFile ${claimFileId} bulunamadı`);
  }
}
