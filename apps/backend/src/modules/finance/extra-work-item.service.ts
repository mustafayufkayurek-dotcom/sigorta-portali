import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import {
  EXTRA_REPAIR_KIND,
  EXTRA_REPAIR_TITLE,
  canOpenHasarExtraRepair,
  extraRepairReasonOk,
  isOpenExtraRepairStatus,
} from '@sigorta/shared';
import { CreateExtraWorkItemDto } from './dto/create-extra-work-item.dto';
import { UpdateExtraWorkItemDto } from './dto/update-extra-work-item.dto';
import { OpenExtraRepairDto, RejectExtraRepairDto } from './dto/open-extra-repair.dto';

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

  async findOpenExtraRepair(claimFileId: string) {
    return this.prisma.extraWorkItem.findFirst({
      where: {
        claimFileId,
        kind: EXTRA_REPAIR_KIND,
        status: { in: ['draft', 'approved'] },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        claimFileId: true,
        title: true,
        description: true,
        status: true,
        kind: true,
        estimatedAmount: true,
        repairReportId: true,
        createdAt: true,
        agreedAt: true,
      },
    });
  }

  async openExtraRepair(
    claimFileId: string,
    dto: OpenExtraRepairDto,
    userId: string,
    roleCode?: string | null,
  ) {
    this.assertNotFieldStaff(roleCode);
    const reason = String(dto.reason ?? '').trim();
    if (!extraRepairReasonOk(reason)) {
      throw new BadRequestException('Ek onarım için gerekçe yazınız.');
    }
    const file = await this.prisma.claimFile.findUnique({
      where: { id: claimFileId },
      select: {
        id: true,
        closedAt: true,
        currentStatus: { select: { code: true, isClosedState: true } },
      },
    });
    if (!file) throw new NotFoundException('Hasar dosyası bulunamadı');
    const fileClosed = Boolean(
      file.closedAt || file.currentStatus?.isClosedState || file.currentStatus?.code === 'closed',
    );
    const fileCancelled = file.currentStatus?.code === 'cancelled';
    const existing = await this.findOpenExtraRepair(claimFileId);
    if (!canOpenHasarExtraRepair({ fileClosed, fileCancelled, extraRepairOpen: Boolean(existing) })) {
      if (!fileClosed) throw new BadRequestException('Ek onarım yalnız kapalı dosyada açılır.');
      if (fileCancelled) throw new BadRequestException('İptal dosyada ek onarım açılmaz.');
      throw new BadRequestException('Bu dosyada açık ek onarım var.');
    }
    return this.prisma.extraWorkItem.create({
      data: {
        claimFileId,
        title: EXTRA_REPAIR_TITLE,
        description: reason,
        kind: EXTRA_REPAIR_KIND,
        estimatedAmount: dto.estimatedAmount ?? null,
        createdByUserId: userId,
        status: 'draft',
      },
    });
  }

  async rejectExtraRepair(
    claimFileId: string,
    id: string,
    dto: RejectExtraRepairDto,
    roleCode?: string | null,
  ) {
    this.assertNotFieldStaff(roleCode);
    const reason = String(dto.reason ?? '').trim();
    if (!extraRepairReasonOk(reason)) {
      throw new BadRequestException('İptal için açıklama yazınız.');
    }
    const item = await this.findOne(claimFileId, id);
    if (item.kind !== EXTRA_REPAIR_KIND || !isOpenExtraRepairStatus(item.status)) {
      throw new BadRequestException('Açık ek onarım bulunamadı.');
    }
    return this.prisma.extraWorkItem.update({
      where: { id },
      data: {
        status: 'cancelled',
        rejectedAt: new Date(),
        rejectReason: reason,
      },
    });
  }

  async completeExtraRepair(claimFileId: string, id: string, roleCode?: string | null) {
    this.assertNotFieldStaff(roleCode);
    const item = await this.findOne(claimFileId, id);
    if (item.kind !== EXTRA_REPAIR_KIND || !isOpenExtraRepairStatus(item.status)) {
      throw new BadRequestException('Açık ek onarım bulunamadı.');
    }
    if (item.status !== 'approved') {
      throw new BadRequestException('Ek rapor onaylanmadan ek onarım bitmez.');
    }
    return this.prisma.extraWorkItem.update({
      where: { id },
      data: {
        status: 'completed',
        completedAt: new Date(),
      },
    });
  }

  private assertNotFieldStaff(roleCode?: string | null) {
    if (String(roleCode ?? '').trim().toLowerCase() === 'field_staff') {
      throw new ForbiddenException('Saha tespit ek onarım açamaz. Ek onarım dosya sorumlusundadır.');
    }
  }

  private async assertClaimFileExists(claimFileId: string): Promise<void> {
    const cf = await this.prisma.claimFile.findUnique({
      where: { id: claimFileId },
      select: { id: true },
    });
    if (!cf) throw new NotFoundException(`ClaimFile ${claimFileId} bulunamadı`);
  }
}
