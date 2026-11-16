import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Optional,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { PrismaService } from '@/prisma/prisma.service';
import { InvoiceRequestsService } from '@/modules/invoice-requests/invoice-requests.service';
import {
  isInspectionServiceKind,
  resolveFileFeeCollectionSource,
  resolveClaimRevenueVat,
  shouldCreateApprovedFileFee,
  STANDARD_SALES_VAT_RATE,
} from '@sigorta/shared';
import { CreateClaimFileRevenueDto } from './dto/create-claim-file-revenue.dto';
import { PartyAccountsService } from './party-accounts.service';

@Injectable()
export class ClaimFileRevenueService {
  private readonly logger = new Logger(ClaimFileRevenueService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly moduleRef?: ModuleRef,
    @Optional()
    @Inject(forwardRef(() => PartyAccountsService))
    private readonly partyAccounts?: PartyAccountsService,
  ) {}

  async create(claimFileId: string, dto: CreateClaimFileRevenueDto, userId: string) {
    const claim = await this.assertClaimFileExists(claimFileId);

    if (dto.revenueType === 'extra_work' && !dto.extraWorkItemId) {
      throw new BadRequestException('extra_work tipi gelir için extraWorkItemId zorunludur');
    }

    if (dto.revenueType === 'file_fee' && dto.extraWorkItemId) {
      throw new BadRequestException('file_fee tipi gelirde extraWorkItemId olmamalıdır');
    }

    if (dto.extraWorkItemId) {
      await this.assertExtraWorkItemBelongs(claimFileId, dto.extraWorkItemId);
    }

    const { billed, vatRate, vatAmount, totalAmount } = resolveClaimRevenueVat({
      billed: dto.billed,
      amount: dto.amount,
      vatRate: dto.vatRate,
    });

    const revenue = await this.prisma.claimFileRevenue.create({
      data: {
        claimFileId,
        revenueType: dto.revenueType,
        collectionSource: resolveFileFeeCollectionSource({
          collectionParty: claim.collectionParty,
          insuranceCompanyId: claim.insuranceCompanyId,
          serviceKind: claim.serviceKind,
        }),
        description: dto.description,
        amount: dto.amount,
        billed,
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
    if (claim.customerId && this.partyAccounts) {
      try {
        await this.partyAccounts.postGelirBorc({
          customerId: claim.customerId,
          revenueId: revenue.id,
          amount: Number(revenue.totalAmount) || Number(revenue.amount) || 0,
          entryDate: revenue.entryDate,
          description:
            revenue.description?.trim() ||
            (dto.revenueType === 'file_fee' ? 'Dosya Bedeli' : 'Gelir'),
          userId,
        });
      } catch (err) {
        this.logger.warn(
          `Gelir cariye yazılamadı (${revenue.id}): ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    if (dto.revenueType === 'file_fee' && isInspectionServiceKind(claim.serviceKind)) {
      // Rapor müşteriye gittiyse Hasar Tespit Hizmet Bedeli girilince fatura talebi açılır.
      try {
        await this.moduleRef
          ?.get(InvoiceRequestsService, { strict: false })
          ?.ensureHasarTespitInvoiceRequest(claimFileId, userId);
      } catch (err) {
        this.logger.warn(`Hasar Tespit fatura talebi (${claimFileId}): ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    return revenue;
  }

  async findAll(claimFileId: string) {
    await this.assertClaimFileExists(claimFileId);
    await this.ensureFileFeeFromApprovedReport(claimFileId);

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

  /**
   * Onaylı onarım raporunda dosya bedeli gelir kaydı yoksa üretir.
   * Onay ≠ gelir kaydı değildi; Gelir sekmesi boş kalıyordu.
   */
  async ensureFileFeeFromApprovedReport(claimFileId: string): Promise<void> {
    // Hasar Tespit: rapor toplamı tespit edilen hasardır, gelir değildir. Hizmet bedeli elle girilir.
    const kind = await this.prisma.claimFile.findUnique({
      where: { id: claimFileId },
      select: { serviceKind: true },
    });
    if (isInspectionServiceKind(kind?.serviceKind)) return;

    const existing = await this.prisma.claimFileRevenue.findFirst({
      where: { claimFileId, revenueType: 'file_fee', status: { not: 'cancelled' } },
      select: { id: true },
    });

    const report = await this.prisma.repairReport.findFirst({
      where: {
        claimFileId,
        status: { in: ['approved', 'externally_approved'] },
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        reportNo: true,
        status: true,
        totalSalesAmount: true,
        createdByUserId: true,
        updatedAt: true,
      },
    });

    if (
      !shouldCreateApprovedFileFee({
        hasFileFee: Boolean(existing),
        reportStatus: report?.status,
        salesAmount: report ? Number(report.totalSalesAmount ?? 0) : 0,
      }) ||
      !report
    ) {
      return;
    }

    const claim = await this.prisma.claimFile.findUnique({
      where: { id: claimFileId },
      select: { insuranceCompanyId: true, collectionParty: true },
    });

    try {
      await this.create(
        claimFileId,
        {
          revenueType: 'file_fee',
          collectionSource: resolveFileFeeCollectionSource({
            collectionParty: claim?.collectionParty,
            insuranceCompanyId: claim?.insuranceCompanyId,
          }),
          description: `Dosya Bedeli — ${report.reportNo}`,
          amount: Number(report.totalSalesAmount),
          vatRate: STANDARD_SALES_VAT_RATE,
          entryDate: (report.updatedAt ?? new Date()).toISOString().slice(0, 10),
          repairReportId: report.id,
          status: 'confirmed',
        },
        report.createdByUserId,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`ensureFileFeeFromApprovedReport (${claimFileId}): ${message}`);
    }
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

      // Hasar Tespit hizmet bedeli dosya müşterisinden tahsil edilir.
      const collectedFromCustomer = revenues
        .filter((r) => r.collectionSource === 'customer')
        .reduce((s, r) => s + r.collectedAmount, 0);

      const totalCollected = collectedFromInsurer + collectedFromInsured + collectedFromCustomer;
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

  private async assertClaimFileExists(id: string) {
    const cf = await this.prisma.claimFile.findUnique({
      where: { id },
      select: {
        id: true,
        customerId: true,
        collectionParty: true,
        insuranceCompanyId: true,
        serviceKind: true,
      },
    });
    if (!cf) throw new NotFoundException(`ClaimFile ${id} bulunamadı`);
    return cf;
  }

  private async assertExtraWorkItemBelongs(claimFileId: string, extraWorkItemId: string): Promise<void> {
    const ewi = await this.prisma.extraWorkItem.findFirst({
      where: { id: extraWorkItemId, claimFileId },
      select: { id: true },
    });
    if (!ewi) throw new BadRequestException(`ExtraWorkItem ${extraWorkItemId} bu dosyaya ait değil`);
  }
}
