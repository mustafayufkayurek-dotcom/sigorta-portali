import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { MarketPricesService } from '../market-prices/market-prices.service';

export interface ItemApprovalContext {
  itemId: string;
  jobDescription: string;
  supplierUnitPrice: number;
  quantity: number;
  unit: string;
  workGroup: { id: string; name: string; code: string } | null;
  marketPrice: {
    referencePrice: number;
    minPrice: number;
    maxPrice: number;
    tolerancePct: number;
    regionType: string;
    deviationPct: number;
    isWithinTolerance: boolean;
  } | null;
  priceHistory: {
    avgPrice: number;
    minPrice: number;
    maxPrice: number;
    sampleCount: number;
    period: string;
  } | null;
  vendorRisk: {
    totalScore: number;
    riskLevel: string;
    disputeRateScore: number;
    revisionFreqScore: number;
    priceDeviationScore: number;
  } | null;
  anomalyFlags: {
    id: string;
    flagType: string;
    severity: string;
    deviationPct: number | null;
    referencePrice: number | null;
  }[];
}

@Injectable()
export class ApprovalContextService {
  constructor(
    private prisma: PrismaService,
    private marketPricesService: MarketPricesService,
  ) {}

  async getReportApprovalContext(reportId: string): Promise<{
    reportId: string;
    vendorId: string | null;
    vendorName: string | null;
    vendorRiskLevel: string | null;
    regionType: string;
    totalSupplierCost: number;
    totalSalesAmount: number;
    grossMarginPct: number;
    criticalFlagCount: number;
    warningFlagCount: number;
    items: ItemApprovalContext[];
  }> {
    const report = await this.prisma.repairReport.findUnique({
      where: { id: reportId },
      include: {
        items: {
          include: {
            workGroup: { select: { id: true, name: true, code: true } },
            anomalyFlags: {
              where: { status: 'open' },
              select: {
                id: true,
                flagType: true,
                severity: true,
                deviationPct: true,
                referencePrice: true,
              },
            },
          },
          orderBy: [{ workGroup: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
        },
        claimFile: {
          include: {
            propertyAddress: true,
            costEntries: {
              where: { vendorId: { not: null } },
              select: { vendorId: true },
              distinct: ['vendorId'],
              take: 1,
            },
          },
        },
      },
    });

    if (!report) throw new Error('Rapor bulunamadı');

    const city = report.claimFile.propertyAddress?.city || '';
    const regionType = this.marketPricesService.cityToRegion(city);
    const vendorId = report.claimFile.costEntries[0]?.vendorId ?? null;

    // Vendor risk skoru
    let vendorRiskData: any = null;
    let vendorName: string | null = null;

    if (vendorId) {
      const [riskScore, vendor] = await Promise.all([
        this.prisma.vendorRiskScore.findUnique({ where: { vendorId } }),
        this.prisma.vendor.findUnique({
          where: { id: vendorId },
          select: { name: true },
        }),
      ]);
      vendorRiskData = riskScore;
      vendorName = vendor?.name ?? null;
    }

    // Her item için bağlam oluştur
    const since12Months = new Date();
    since12Months.setFullYear(since12Months.getFullYear() - 1);

    const itemContexts: ItemApprovalContext[] = await Promise.all(
      report.items.map(async (item) => {
        // Piyasa rayici
        const catalog = await this.marketPricesService.lookup(
          item.workGroupId,
          item.jobDescription,
          regionType,
        );

        let marketPrice: ItemApprovalContext['marketPrice'] = null;
        if (catalog && item.supplierUnitPrice > 0) {
          const deviationPct =
            ((item.supplierUnitPrice - catalog.referencePrice) / catalog.referencePrice) * 100;
          marketPrice = {
            referencePrice: catalog.referencePrice,
            minPrice: catalog.minPrice,
            maxPrice: catalog.maxPrice,
            tolerancePct: catalog.tolerancePct,
            regionType: catalog.regionType,
            deviationPct: Math.round(deviationPct * 100) / 100,
            isWithinTolerance: Math.abs(deviationPct) <= catalog.tolerancePct,
          };
        }

        // Fiyat geçmişi
        const historyData = await this.prisma.supplierPriceHistory.findMany({
          where: {
            workGroupId: item.workGroupId,
            jobDescription: { contains: item.jobDescription, mode: 'insensitive' },
            recordedAt: { gte: since12Months },
          },
          select: { supplierUnitPrice: true },
        });

        let priceHistory: ItemApprovalContext['priceHistory'] = null;
        if (historyData.length > 0) {
          const prices = historyData.map((h) => h.supplierUnitPrice);
          const avg = prices.reduce((s, p) => s + p, 0) / prices.length;
          priceHistory = {
            avgPrice: Math.round(avg * 100) / 100,
            minPrice: Math.min(...prices),
            maxPrice: Math.max(...prices),
            sampleCount: prices.length,
            period: 'Son 12 ay',
          };
        }

        return {
          itemId: item.id,
          jobDescription: item.jobDescription,
          supplierUnitPrice: item.supplierUnitPrice,
          quantity: item.quantity,
          unit: item.unit,
          workGroup: item.workGroup,
          marketPrice,
          priceHistory,
          vendorRisk: vendorRiskData
            ? {
                totalScore: vendorRiskData.totalScore,
                riskLevel: vendorRiskData.riskLevel,
                disputeRateScore: vendorRiskData.disputeRateScore,
                revisionFreqScore: vendorRiskData.revisionFreqScore,
                priceDeviationScore: vendorRiskData.priceDeviationScore,
              }
            : null,
          anomalyFlags: item.anomalyFlags,
        };
      }),
    );

    const criticalFlagCount = itemContexts.reduce(
      (s, i) => s + i.anomalyFlags.filter((f) => f.severity === 'critical').length,
      0,
    );
    const warningFlagCount = itemContexts.reduce(
      (s, i) => s + i.anomalyFlags.filter((f) => f.severity === 'warning').length,
      0,
    );

    return {
      reportId,
      vendorId,
      vendorName,
      vendorRiskLevel: vendorRiskData?.riskLevel ?? null,
      regionType,
      totalSupplierCost: report.totalSupplierCost,
      totalSalesAmount: report.totalSalesAmount,
      grossMarginPct: report.grossMarginPct,
      criticalFlagCount,
      warningFlagCount,
      items: itemContexts,
    };
  }
}
