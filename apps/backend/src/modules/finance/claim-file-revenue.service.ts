import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateClaimFileRevenueDto } from './dto/create-claim-file-revenue.dto';

@Injectable()
export class ClaimFileRevenueService {
  private readonly logger = new Logger(ClaimFileRevenueService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(claimFileId: string, dto: CreateClaimFileRevenueDto, userId: string) {
    await this.assertClaimFileExists(claimFileId);

    if (dto.revenueType === 'extra_work' && !dto.extraWorkItemId) {
      throw new BadRequestException('extra_work tipi gelir için extraWorkItemId zorunludur');
    }

    if (dto.revenueType === 'file_fee' && dto.extraWorkItemId) {
      throw new BadRequestException('file_fee tipi gelirde extraWorkItemId olmamalıdır');
    }

    if (dto.extraWorkItemId) {
      await this.assertExtraWorkItemBelongs(claimFileId, dto.extraWorkItemId);
    }

    const vatRate = dto.vatRate ?? 0;
    const vatAmount = (dto.amount * vatRate) / 100;
    const totalAmount = dto.amount + vatAmount;

    const revenue = await this.prisma.claimFileRevenue.create({
      data: {
        claimFileId,
        revenueType: dto.revenueType,
        collectionSource: dto.collectionSource,
        description: dto.description,
        amount: dto.amount,
        vatRate,
        vatAmount,
        totalAmount,
        invoiceId: dto.invoiceId,
        repairReportId: dto.repairReportId,
        extraWorkItemId: dto.extraWorkItemId ?? null,
        status: dto.status ?? 'confirmed',
        collectedAmount: dto.collectedAmount ?? 0,
        collectedAt: dto.collectedAt ? new Date(dto.collectedAt) : null,
        relatedPaymentId: dto.relatedPaymentId ?? null,
        entryDate: new Date(dto.entryDate),
        createdByUserId: userId,
        notes: dto.notes,
      },
      include: {
        extraWorkItem: { select: { id: true, title: true } },
        invoice: { select: { id: true, invoiceNo: true } },
      },
    });

    await this.recalcSummary(claimFileId);
    return revenue;
  }

  async findAll(claimFileId: string) {
    await this.assertClaimFileExists(claimFileId);

    return this.prisma.claimFileRevenue.findMany({
      where: { claimFileId },
      include: {
        extraWorkItem: { select: { id: true, title: true, status: true } },
        invoice: { select: { id: true, invoiceNo: true } },
        repairReport: { select: { id: true, reportNo: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { entryDate: 'desc' },
    });
  }

  async findOne(claimFileId: string, id: string) {
    const rev = await this.prisma.claimFileRevenue.findFirst({
      where: { id, claimFileId },
      include: {
        extraWorkItem: true,
        invoice: true,
        repairReport: { select: { id: true, reportNo: true } },
        relatedPayment: { select: { id: true, amount: true, paymentDate: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (!rev) throw new NotFoundException(`ClaimFileRevenue ${id} bulunamadı`);
    return rev;
  }

  async updateCollected(claimFileId: string, id: string, collectedAmount: number, collectedAt?: string) {
    const rev = await this.findOne(claimFileId, id);

    if (collectedAmount > rev.totalAmount) {
      throw new BadRequestException('Tahsil edilen tutar gelir tutarını aşamaz');
    }

    const updated = await this.prisma.claimFileRevenue.update({
      where: { id },
      data: {
        collectedAmount,
        collectedAt: collectedAt ? new Date(collectedAt) : new Date(),
        status: collectedAmount >= rev.totalAmount ? 'collected' : 'confirmed',
      },
    });

    await this.recalcSummary(claimFileId);
    return updated;
  }

  async remove(claimFileId: string, id: string) {
    const rev = await this.findOne(claimFileId, id);

    if (rev.status === 'collected') {
      throw new BadRequestException('Tahsil edilmiş gelir kaydı silinemez');
    }

    await this.prisma.claimFileRevenue.delete({ where: { id } });
    await this.recalcSummary(claimFileId);
    return { deleted: true };
  }

  private async recalcSummary(claimFileId: string): Promise<void> {
    try {
      const revenues = await this.prisma.claimFileRevenue.findMany({
        where: { claimFileId, status: { not: 'cancelled' } },
      });

      const fileFeeRevenue = revenues
        .filter((r) => r.revenueType === 'file_fee')
        .reduce((s, r) => s + r.totalAmount, 0);

      const extraWorkRevenue = revenues
        .filter((r) => r.revenueType === 'extra_work')
        .reduce((s, r) => s + r.totalAmount, 0);

      const totalRevenue = fileFeeRevenue + extraWorkRevenue;

      const collectedFromInsurer = revenues
        .filter((r) => r.collectionSource === 'insurance_company')
        .reduce((s, r) => s + r.collectedAmount, 0);

      const collectedFromInsured = revenues
        .filter((r) => r.collectionSource === 'insured')
        .reduce((s, r) => s + r.collectedAmount, 0);

      const totalCollected = collectedFromInsurer + collectedFromInsured;
      const outstandingBalance = totalRevenue - totalCollected;

      await this.prisma.claimFinancialSummary.upsert({
        where: { claimFileId },
        create: {
          claimFileId,
          fileFeeRevenue,
          extraWorkRevenue,
          totalRevenue,
          collectedFromInsurer,
          collectedFromInsured,
          totalCollected,
          outstandingBalance,
          lastCalculatedAt: new Date(),
        },
        update: {
          fileFeeRevenue,
          extraWorkRevenue,
          totalRevenue,
          collectedFromInsurer,
          collectedFromInsured,
          totalCollected,
          outstandingBalance,
          lastCalculatedAt: new Date(),
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`recalcSummary hatası (${claimFileId}): ${message}`);
    }
  }

  private async assertClaimFileExists(id: string): Promise<void> {
    const cf = await this.prisma.claimFile.findUnique({ where: { id }, select: { id: true } });
    if (!cf) throw new NotFoundException(`ClaimFile ${id} bulunamadı`);
  }

  private async assertExtraWorkItemBelongs(claimFileId: string, extraWorkItemId: string): Promise<void> {
    const ewi = await this.prisma.extraWorkItem.findFirst({
      where: { id: extraWorkItemId, claimFileId },
      select: { id: true },
    });
    if (!ewi) throw new BadRequestException(`ExtraWorkItem ${extraWorkItemId} bu dosyaya ait değil`);
  }
}
