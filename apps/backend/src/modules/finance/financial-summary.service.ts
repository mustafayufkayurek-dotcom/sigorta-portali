import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

/**
 * Bir hasar dosyasının tüm P&L bileşenlerini yeniden hesaplayarak
 * ClaimFinancialSummary tablosunu günceller.
 *
 * Net Kâr = Toplam Gelir − Toplam Değişken Gider − Overhead Payı
 */
@Injectable()
export class FinancialSummaryService {
  private readonly logger = new Logger(FinancialSummaryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async recalculate(claimFileId: string): Promise<void> {
    try {
      const [revenues, costEntries] = await Promise.all([
        this.prisma.claimFileRevenue.findMany({
          where: { claimFileId, status: { not: 'cancelled' } },
        }),
        this.prisma.costEntry.findMany({ where: { claimFileId } }),
      ]);

      // ── Gelir kırılımı ─────────────────────────────────────────────────────
      const fileFeeRevenue = revenues
        .filter((r) => r.revenueType === 'file_fee')
        .reduce((s, r) => s + r.totalAmount, 0);

      const extraWorkRevenue = revenues
        .filter((r) => r.revenueType === 'extra_work')
        .reduce((s, r) => s + r.totalAmount, 0);

      const totalRevenue = fileFeeRevenue + extraWorkRevenue;

      // ── Tahsilat kırılımı ──────────────────────────────────────────────────
      const collectedFromInsurer = revenues
        .filter((r) => r.collectionSource === 'insurance_company')
        .reduce((s, r) => s + r.collectedAmount, 0);

      const collectedFromInsured = revenues
        .filter((r) => r.collectionSource === 'insured')
        .reduce((s, r) => s + r.collectedAmount, 0);

      const totalCollected = collectedFromInsurer + collectedFromInsured;
      const outstandingBalance = totalRevenue - totalCollected;

      // ── Gider kırılımı ─────────────────────────────────────────────────────
      const variableCosts = costEntries.filter((c) => !c.isOverhead);
      const overheadCosts = costEntries.filter((c) => c.isOverhead);

      const vendorCost = variableCosts
        .filter((c) => c.category === 'VENDOR_PAYMENT' || c.source === 'vendor_statement')
        .reduce((s, c) => s + c.amount, 0);

      const fieldExpenseCost = variableCosts
        .filter((c) => ['MANAGER_TRAVEL', 'INSPECTION_FEE'].includes(c.category))
        .reduce((s, c) => s + c.amount, 0);

      const materialCost = variableCosts
        .filter((c) => c.category === 'MATERIAL')
        .reduce((s, c) => s + c.amount, 0);

      const communicationCost = variableCosts
        .filter((c) => c.category === 'COMMUNICATION')
        .reduce((s, c) => s + c.amount, 0);

      const otherVariableCost = variableCosts
        .filter(
          (c) =>
            !['VENDOR_PAYMENT', 'MANAGER_TRAVEL', 'INSPECTION_FEE', 'MATERIAL', 'COMMUNICATION'].includes(
              c.category,
            ) && c.source !== 'vendor_statement',
        )
        .reduce((s, c) => s + c.amount, 0);

      const totalVariableCost =
        vendorCost + fieldExpenseCost + materialCost + communicationCost + otherVariableCost;

      const overheadShare = overheadCosts.reduce((s, c) => s + c.amount, 0);
      const totalCost = totalVariableCost + overheadShare;

      // ── Net P&L ────────────────────────────────────────────────────────────
      const netProfit = totalRevenue - totalCost;
      const netMarginPct = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

      await this.prisma.claimFinancialSummary.upsert({
        where: { claimFileId },
        create: {
          claimFileId,
          // Gelir
          fileFeeRevenue,
          extraWorkRevenue,
          totalRevenue,
          // Gider
          vendorCost,
          fieldExpenseCost,
          materialCost,
          communicationCost,
          otherVariableCost,
          totalVariableCost,
          overheadShare,
          totalCost,
          // Kâr
          netProfit,
          netMarginPct: Math.round(netMarginPct * 100) / 100,
          // Tahsilat
          collectedFromInsurer,
          collectedFromInsured,
          totalCollected,
          outstandingBalance,
          // Eski alanlar (geriye dönük uyumluluk)
          actualRevenue: totalRevenue,
          actualCost: totalCost,
          grossProfit: netProfit,
          grossMarginPct: Math.round(netMarginPct * 100) / 100,
          lastCalculatedAt: new Date(),
        },
        update: {
          fileFeeRevenue,
          extraWorkRevenue,
          totalRevenue,
          vendorCost,
          fieldExpenseCost,
          materialCost,
          communicationCost,
          otherVariableCost,
          totalVariableCost,
          overheadShare,
          totalCost,
          netProfit,
          netMarginPct: Math.round(netMarginPct * 100) / 100,
          collectedFromInsurer,
          collectedFromInsured,
          totalCollected,
          outstandingBalance,
          actualRevenue: totalRevenue,
          actualCost: totalCost,
          grossProfit: netProfit,
          grossMarginPct: Math.round(netMarginPct * 100) / 100,
          lastCalculatedAt: new Date(),
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`recalculate hatası (${claimFileId}): ${message}`);
    }
  }

  /**
   * Birden fazla dosyayı toplu yeniden hesapla (overhead dağıtımı sonrası vb.)
   */
  async recalculateBatch(claimFileIds: string[]): Promise<void> {
    await Promise.all(claimFileIds.map((id) => this.recalculate(id)));
  }

  /**
   * Portföy genelinde P&L özeti (Finans Analitik API için)
   */
  async getPortfolioPL(filters?: { year?: number; month?: number }) {
    /**
     * Dönem filtresi: dosya açılış tarihine göre değil, fatura tarihine göre.
     * Aksi halde "Bu Ay" KPI'ları yeni açılan (henüz faturasız) dosyalarda 0 kalır;
     * eski dosyaların dönem cirosu da görünmez.
     */
    if (filters?.year) {
      const periodStart = new Date(
        filters.year,
        filters.month ? filters.month - 1 : 0,
        1,
      );
      const periodEnd = new Date(
        filters.year,
        filters.month ? filters.month : 12,
        0,
        23,
        59,
        59,
        999,
      );

      const invoices = await this.prisma.invoice.findMany({
        where: {
          invoiceDate: { gte: periodStart, lte: periodEnd },
          status: { not: 'cancelled' },
        },
        select: {
          invoiceType: true,
          totalAmount: true,
          claimFileId: true,
          status: true,
        },
      });

      const fileIds = new Set<string>();
      let totalRevenue = 0;
      let totalCost = 0;
      let totalCollected = 0;
      for (const inv of invoices) {
        if (inv.claimFileId) fileIds.add(inv.claimFileId);
        const amount = Number(inv.totalAmount) || 0;
        if (inv.invoiceType === 'sales') {
          totalRevenue += amount;
          if (inv.status === 'paid') totalCollected += amount;
        } else {
          totalCost += amount;
        }
      }

      const summaries = fileIds.size
        ? await this.prisma.claimFinancialSummary.findMany({
            where: { claimFileId: { in: [...fileIds] } },
            select: {
              fileFeeRevenue: true,
              extraWorkRevenue: true,
              totalVariableCost: true,
              overheadShare: true,
            },
          })
        : [];

      const fileFeeRevenue = summaries.reduce((s, r) => s + (r.fileFeeRevenue ?? 0), 0);
      const extraWorkRevenue = summaries.reduce((s, r) => s + (r.extraWorkRevenue ?? 0), 0);
      const totalVariableCost = summaries.reduce((s, r) => s + (r.totalVariableCost ?? 0), 0);
      const overheadShare = summaries.reduce((s, r) => s + (r.overheadShare ?? 0), 0);
      const netProfit = totalRevenue - totalCost;
      const netMarginPct = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

      return {
        fileCount: fileIds.size,
        totalRevenue,
        fileFeeRevenue,
        extraWorkRevenue,
        totalCost,
        totalVariableCost,
        overheadShare,
        netProfit,
        totalCollected,
        outstandingBalance: Math.max(0, totalRevenue - totalCollected),
        netMarginPct: Math.round(netMarginPct * 100) / 100,
      };
    }

    const summaries = await this.prisma.claimFinancialSummary.findMany({
      include: {
        claimFile: {
          select: {
            id: true,
            fileNo: true,
            createdAt: true,
          },
        },
      },
    });

    const aggregate = summaries.reduce(
      (acc, s) => ({
        totalRevenue: acc.totalRevenue + s.totalRevenue,
        fileFeeRevenue: acc.fileFeeRevenue + s.fileFeeRevenue,
        extraWorkRevenue: acc.extraWorkRevenue + s.extraWorkRevenue,
        totalCost: acc.totalCost + s.totalCost,
        totalVariableCost: acc.totalVariableCost + s.totalVariableCost,
        overheadShare: acc.overheadShare + s.overheadShare,
        netProfit: acc.netProfit + s.netProfit,
        totalCollected: acc.totalCollected + s.totalCollected,
        outstandingBalance: acc.outstandingBalance + s.outstandingBalance,
      }),
      {
        totalRevenue: 0,
        fileFeeRevenue: 0,
        extraWorkRevenue: 0,
        totalCost: 0,
        totalVariableCost: 0,
        overheadShare: 0,
        netProfit: 0,
        totalCollected: 0,
        outstandingBalance: 0,
      },
    );

    const netMarginPct =
      aggregate.totalRevenue > 0
        ? (aggregate.netProfit / aggregate.totalRevenue) * 100
        : 0;

    return {
      fileCount: summaries.length,
      ...aggregate,
      netMarginPct: Math.round(netMarginPct * 100) / 100,
    };
  }

  /**
   * Dosya kârlılık sıralaması
   */
  async getProfitabilityRanking(limit = 20) {
    return this.prisma.claimFinancialSummary.findMany({
      orderBy: { netProfit: 'desc' },
      take: limit,
      include: {
        claimFile: {
          select: {
            id: true,
            fileNo: true,
            createdAt: true,
          },
        },
      },
    });
  }
}
