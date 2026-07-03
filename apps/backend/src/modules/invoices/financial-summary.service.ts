import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class FinancialSummaryService {
  constructor(private prisma: PrismaService) {}

  async recalculate(claimFileId: string) {
    const claimFile = await this.prisma.claimFile.findUnique({
      where: { id: claimFileId },
      select: { estimatedCostAmount: true, approvedBudgetAmount: true },
    });
    if (!claimFile) return;

    // actualRevenue = sum of non-cancelled sales invoices
    const revenueAgg = await this.prisma.invoice.aggregate({
      where: { claimFileId, invoiceType: 'sales', status: { not: 'cancelled' } },
      _sum: { totalAmount: true },
    });

    // actualCost = sum of non-cancelled purchase invoices + cost_entries
    const purchaseAgg = await this.prisma.invoice.aggregate({
      where: { claimFileId, invoiceType: 'purchase', status: { not: 'cancelled' } },
      _sum: { totalAmount: true },
    });

    const costAgg = await this.prisma.costEntry.aggregate({
      where: { claimFileId },
      _sum: { amount: true },
    });

    // collectedAmount = sum of completed incoming payments
    const collectedAgg = await this.prisma.payment.aggregate({
      where: { claimFileId, paymentType: 'incoming', status: 'completed' },
      _sum: { amount: true },
    });

    const actualRevenue = revenueAgg._sum.totalAmount ?? 0;
    const actualCost = (purchaseAgg._sum.totalAmount ?? 0) + (costAgg._sum.amount ?? 0);
    const grossProfit = actualRevenue - actualCost;
    const grossMarginPct = actualRevenue > 0 ? (grossProfit / actualRevenue) * 100 : 0;
    const collectedAmount = collectedAgg._sum.amount ?? 0;

    await this.prisma.claimFinancialSummary.upsert({
      where: { claimFileId },
      create: {
        claimFileId,
        estimatedRevenue: claimFile.approvedBudgetAmount ?? 0,
        actualRevenue,
        estimatedCost: claimFile.estimatedCostAmount ?? 0,
        actualCost,
        grossProfit,
        grossMarginPct,
        lastCalculatedAt: new Date(),
      },
      update: {
        estimatedRevenue: claimFile.approvedBudgetAmount ?? 0,
        actualRevenue,
        estimatedCost: claimFile.estimatedCostAmount ?? 0,
        actualCost,
        grossProfit,
        grossMarginPct,
        lastCalculatedAt: new Date(),
      },
    });

    // Update ClaimFile denormalized fields
    await this.prisma.claimFile.update({
      where: { id: claimFileId },
      data: {
        invoicedAmount: actualRevenue,
        actualCostAmount: actualCost,
        collectedAmount,
        profitAmount: grossProfit,
      },
    });

    return { actualRevenue, actualCost, grossProfit, grossMarginPct, collectedAmount };
  }

  async getByClaimFile(claimFileId: string) {
    return this.prisma.claimFinancialSummary.findUnique({ where: { claimFileId } });
  }
}
