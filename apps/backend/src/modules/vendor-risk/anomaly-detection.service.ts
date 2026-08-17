import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { MarketPricesService } from '../market-prices/market-prices.service';

export const FLAG_TYPES = {
  PRICE_ABOVE_TOLERANCE: 'price_above_tolerance',
  PRICE_BELOW_TOLERANCE: 'price_below_tolerance',
  ITEM_COUNT_ANOMALY: 'item_count_anomaly',
  DUPLICATE_VENDOR_PERIOD: 'duplicate_vendor_period',
  CONCENTRATION_WARNING: 'concentration_warning',
  MARKET_DEVIATION: 'market_deviation',
  PRICE_HISTORY_ANOMALY: 'price_history_anomaly',
} as const;

type FlagType = (typeof FLAG_TYPES)[keyof typeof FLAG_TYPES];

@Injectable()
export class AnomalyDetectionService {
  private readonly logger = new Logger(AnomalyDetectionService.name);

  constructor(
    private prisma: PrismaService,
    private marketPricesService: MarketPricesService,
  ) {}

  // ─── Bir Raporun Tüm Kalemlerini Analiz Et ───────────────────────────────
  async analyzeReport(reportId: string): Promise<void> {
    const report = await this.prisma.repairReport.findUnique({
      where: { id: reportId },
      include: {
        items: {
          include: { workGroup: true },
        },
        claimFile: {
          include: {
            propertyAddress: true,
            costEntries: {
              where: { vendorId: { not: null } },
              select: { vendorId: true },
              distinct: ['vendorId'],
            },
          },
        },
      },
    });

    if (!report) return;

    const city = report.claimFile.propertyAddress?.city || '';
    const regionType = this.marketPricesService.cityToRegion(city);

    // Rapordaki tedarikçi (varsa)
    const vendorId = report.claimFile.costEntries[0]?.vendorId ?? null;

    // Mevcut flagları temizle (yeniden analiz için)
    await this.prisma.repairItemAnomalyFlag.deleteMany({
      where: { reportId },
    });

    const flagsToCreate: any[] = [];

    for (const item of report.items) {
      // Kural 1 & 4: Fiyat anomalisi
      const priceAnomalies = await this.checkPriceAnomaly(
        item,
        reportId,
        vendorId,
        regionType,
      );
      flagsToCreate.push(...priceAnomalies);

      // Kural 4: Geçmiş fiyat anomalisi
      const historyAnomalies = await this.checkPriceHistoryAnomaly(item, reportId, vendorId);
      flagsToCreate.push(...historyAnomalies);
    }

    // Kural 2: İş kalemi sayısı anomalisi
    const countAnomaly = await this.checkItemCountAnomaly(report, reportId, vendorId);
    if (countAnomaly) flagsToCreate.push(countAnomaly);

    // Kural 3: Aynı tedarikçi aynı dönem benzer dosya
    if (vendorId) {
      const duplicateAnomalies = await this.checkDuplicateVendorPeriod(
        vendorId,
        reportId,
        report.totalSupplierCost,
        report.items,
      );
      flagsToCreate.push(...duplicateAnomalies);
    }

    if (flagsToCreate.length > 0) {
      await this.prisma.repairItemAnomalyFlag.createMany({
        data: flagsToCreate,
        skipDuplicates: true,
      });
      this.logger.log(`Created ${flagsToCreate.length} anomaly flags for report ${reportId}`);
    }
  }

  // ─── Kural 1 & Market: Fiyat Sapma Tespiti ───────────────────────────────
  private async checkPriceAnomaly(
    item: any,
    reportId: string,
    vendorId: string | null,
    regionType: string,
  ): Promise<any[]> {
    const catalog = await this.marketPricesService.lookup(
      item.workGroupId,
      item.jobDescription,
      regionType,
    );

    if (!catalog) return [];

    const supplierPrice = item.supplierUnitPrice;
    if (!supplierPrice || supplierPrice === 0) return [];

    const deviationPct =
      ((supplierPrice - catalog.referencePrice) / catalog.referencePrice) * 100;
    const absDeviation = Math.abs(deviationPct);

    if (absDeviation <= catalog.tolerancePct) return [];

    const flagType: FlagType =
      deviationPct > 0
        ? FLAG_TYPES.PRICE_ABOVE_TOLERANCE
        : FLAG_TYPES.PRICE_BELOW_TOLERANCE;

    const severity: 'warning' | 'critical' =
      absDeviation > catalog.tolerancePct * 2 ? 'critical' : 'warning';

    return [
      {
        repairReportItemId: item.id,
        reportId,
        vendorId,
        catalogId: catalog.id,
        flagType,
        deviationPct: Math.round(deviationPct * 100) / 100,
        supplierPrice,
        referencePrice: catalog.referencePrice,
        severity,
        status: 'open',
      },
    ];
  }

  // ─── Kural 4: Geçmiş Fiyat Anomalisi ─────────────────────────────────────
  private async checkPriceHistoryAnomaly(
    item: any,
    reportId: string,
    vendorId: string | null,
  ): Promise<any[]> {
    const since = new Date();
    since.setFullYear(since.getFullYear() - 1);

    const history = await this.prisma.supplierPriceHistory.findMany({
      where: {
        workGroupId: item.workGroupId,
        jobDescription: { contains: item.jobDescription, mode: 'insensitive' },
        recordedAt: { gte: since },
      },
      select: { supplierUnitPrice: true },
    });

    if (history.length < 3) return []; // Yetersiz veri

    const prices = history.map((h) => h.supplierUnitPrice);
    const mean = prices.reduce((s, p) => s + p, 0) / prices.length;
    const variance = prices.reduce((s, p) => s + Math.pow(p - mean, 2), 0) / prices.length;
    const std = Math.sqrt(variance);

    if (std === 0) return [];

    const supplierPrice = item.supplierUnitPrice;
    if (!supplierPrice) return [];

    const zScore = Math.abs((supplierPrice - mean) / std);
    if (zScore <= 2) return []; // 2 sigma içinde normal

    const deviationPct = ((supplierPrice - mean) / mean) * 100;
    const severity: 'warning' | 'critical' = zScore > 3 ? 'critical' : 'warning';

    return [
      {
        repairReportItemId: item.id,
        reportId,
        vendorId,
        catalogId: null,
        flagType: FLAG_TYPES.PRICE_HISTORY_ANOMALY,
        deviationPct: Math.round(deviationPct * 100) / 100,
        supplierPrice,
        referencePrice: Math.round(mean * 100) / 100,
        severity,
        status: 'open',
      },
    ];
  }

  // ─── Kural 2: İş Kalemi Sayısı Anomalisi ─────────────────────────────────
  private async checkItemCountAnomaly(
    report: any,
    reportId: string,
    vendorId: string | null,
  ): Promise<any | null> {
    const claimFile = report.claimFile;
    if (!claimFile.productBranch) return null;

    const since = new Date();
    since.setFullYear(since.getFullYear() - 1);

    // Aynı branş/hasar türündeki geçmiş raporların ortalama item sayısı
    const historicalReports = await this.prisma.repairReport.findMany({
      where: {
        id: { not: reportId },
        claimFile: {
          productBranch: claimFile.productBranch,
          ...(claimFile.lossType && { lossType: claimFile.lossType }),
        },
        createdAt: { gte: since },
        status: { in: ['approved', 'submitted'] },
      },
      select: {
        _count: { select: { items: true } },
      },
      take: 50,
    });

    if (historicalReports.length < 5) return null;

    const counts = historicalReports.map((r) => r._count.items);
    const mean = counts.reduce((s, c) => s + c, 0) / counts.length;
    const variance = counts.reduce((s, c) => s + Math.pow(c - mean, 2), 0) / counts.length;
    const std = Math.sqrt(variance);

    if (std === 0) return null;

    const currentCount = report.items.length;
    const zScore = (currentCount - mean) / std;

    if (zScore <= 2) return null;

    const severity: 'warning' | 'critical' = zScore > 3 ? 'critical' : 'warning';

    // Flag'i ilk item'a ata
    const firstItemId = report.items[0]?.id;
    if (!firstItemId) return null;

    return {
      repairReportItemId: firstItemId,
      reportId,
      vendorId,
      catalogId: null,
      flagType: FLAG_TYPES.ITEM_COUNT_ANOMALY,
      deviationPct: Math.round(((currentCount - mean) / mean) * 100),
      supplierPrice: currentCount,
      referencePrice: Math.round(mean * 100) / 100,
      severity,
      status: 'open',
    };
  }

  // ─── Kural 3: Aynı Tedarikçi Aynı Dönem Benzer Dosya ────────────────────
  private async checkDuplicateVendorPeriod(
    vendorId: string,
    reportId: string,
    totalAmount: number,
    items: any[],
  ): Promise<any[]> {
    if (totalAmount === 0) return [];

    const since = new Date();
    since.setDate(since.getDate() - 30);

    // Aynı tedarikçinin son 30 gündeki benzer tutarlı raporları
    const vendorReports = await this.prisma.repairReport.findMany({
      where: {
        id: { not: reportId },
        claimFile: {
          costEntries: { some: { vendorId } },
        },
        createdAt: { gte: since },
      },
      select: {
        id: true,
        totalSupplierCost: true,
      },
    });

    // ±5% benzerlik kontrolü
    const SIMILARITY_THRESHOLD = 0.05;
    const similar = vendorReports.filter((r) => {
      if (r.totalSupplierCost === 0) return false;
      const diff = Math.abs(r.totalSupplierCost - totalAmount) / totalAmount;
      return diff <= SIMILARITY_THRESHOLD;
    });

    if (similar.length < 2) return []; // 2'den az benzer dosya varsa normal

    const firstItemId = items[0]?.id;
    if (!firstItemId) return [];

    return [
      {
        repairReportItemId: firstItemId,
        reportId,
        vendorId,
        catalogId: null,
        flagType: FLAG_TYPES.DUPLICATE_VENDOR_PERIOD,
        deviationPct: null,
        supplierPrice: totalAmount,
        referencePrice: null,
        severity: 'warning' as const,
        status: 'open',
      },
    ];
  }

  // ─── Açık Anomalileri Getir ───────────────────────────────────────────────
  async findOpenAnomalies(params: {
    page?: number;
    limit?: number;
    vendorId?: string;
    flagType?: string;
    severity?: string;
    reportId?: string;
  }) {
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = { status: 'open' };
    if (params.vendorId) where.vendorId = params.vendorId;
    if (params.flagType) where.flagType = params.flagType;
    if (params.severity) where.severity = params.severity;
    if (params.reportId) where.reportId = params.reportId;

    const [rows, total] = await Promise.all([
      this.prisma.repairItemAnomalyFlag.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
        include: {
          repairReportItem: {
            select: {
              id: true,
              jobDescription: true,
              supplierUnitPrice: true,
              quantity: true,
              unit: true,
              workGroup: { select: { id: true, name: true } },
            },
          },
          catalog: {
            select: { id: true, referencePrice: true, minPrice: true, maxPrice: true, regionType: true },
          },
        },
      }),
      this.prisma.repairItemAnomalyFlag.count({ where }),
    ]);

    return { data: rows, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async getAnomaliesByReport(reportId: string) {
    return this.prisma.repairItemAnomalyFlag.findMany({
      where: { reportId },
      include: {
        repairReportItem: {
          select: {
            id: true,
            jobDescription: true,
            supplierUnitPrice: true,
            salesUnitPrice: true,
            quantity: true,
            unit: true,
            workGroup: { select: { id: true, name: true, code: true } },
          },
        },
        catalog: {
          select: {
            id: true,
            referencePrice: true,
            minPrice: true,
            maxPrice: true,
            regionType: true,
            tolerancePct: true,
          },
        },
      },
      orderBy: [{ severity: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async reviewAnomaly(
    id: string,
    userId: string,
    status: 'reviewed' | 'dismissed' | 'escalated',
    reviewNote?: string,
  ) {
    return this.prisma.repairItemAnomalyFlag.update({
      where: { id },
      data: {
        status,
        reviewedByUserId: userId,
        reviewedAt: new Date(),
        reviewNote,
      },
    });
  }
}
