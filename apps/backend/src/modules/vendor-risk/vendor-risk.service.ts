import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

export interface RiskScoreComponents {
  disputeRateScore: number;
  revisionFreqScore: number;
  priceDeviationScore: number;
  deliveryComplianceScore: number;
  concentrationScore: number;
}

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

// Ağırlıklar (toplamı = 1.0)
const WEIGHTS = {
  disputeRate: 0.30,
  revisionFreq: 0.20,
  priceDeviation: 0.25,
  deliveryCompliance: 0.10,
  concentration: 0.15,
} as const;

function clamp(val: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, val));
}

function toRiskLevel(score: number): RiskLevel {
  if (score < 25) return 'low';
  if (score < 50) return 'medium';
  if (score < 75) return 'high';
  return 'critical';
}

@Injectable()
export class VendorRiskService {
  private readonly logger = new Logger(VendorRiskService.name);

  constructor(private prisma: PrismaService) {}

  // ─── Bileşen 1: İtiraz Oranı ─────────────────────────────────────────────
  private async calcDisputeRateScore(vendorId: string): Promise<number> {
    const since = new Date();
    since.setMonth(since.getMonth() - 6);

    const [totalItems, disputedItems] = await Promise.all([
      this.prisma.vendorStatementItem.count({
        where: { statement: { vendorId }, createdAt: { gte: since } },
      }),
      this.prisma.vendorStatementItem.count({
        where: {
          statement: { vendorId },
          approvalStatus: 'DISPUTED',
          createdAt: { gte: since },
        },
      }),
    ]);

    if (totalItems === 0) return 0;
    const rate = disputedItems / totalItems;
    return clamp(rate * 500); // %20 itiraz oranı → 100 puan
  }

  // ─── Bileşen 2: Revizyon Sıklığı ─────────────────────────────────────────
  private async calcRevisionFreqScore(vendorId: string): Promise<number> {
    const since = new Date();
    since.setMonth(since.getMonth() - 6);

    // Tedarikçinin iş yaptığı hasar dosyalarının revizyon sayısı
    const reports = await this.prisma.repairReport.findMany({
      where: {
        claimFile: {
          costEntries: { some: { vendorId } },
        },
        createdAt: { gte: since },
      },
      select: { revisionCount: true },
    });

    if (reports.length === 0) return 0;
    const avgRevision = reports.reduce((s, r) => s + r.revisionCount, 0) / reports.length;
    return clamp(avgRevision * 25); // 4 revizyon ortalaması → 100 puan
  }

  // ─── Bileşen 3: Fiyat Sapması ─────────────────────────────────────────────
  private async calcPriceDeviationScore(vendorId: string): Promise<number> {
    const since = new Date();
    since.setMonth(since.getMonth() - 3);

    const flags = await this.prisma.repairItemAnomalyFlag.findMany({
      where: {
        vendorId,
        flagType: { in: ['price_above_tolerance', 'price_below_tolerance', 'market_deviation'] },
        createdAt: { gte: since },
      },
      select: { deviationPct: true },
    });

    if (flags.length === 0) return 0;
    const avgDeviation = flags.reduce((s, f) => s + Math.abs(f.deviationPct ?? 0), 0) / flags.length;
    return clamp(avgDeviation * 2); // %50 ortalama sapma → 100 puan
  }

  // ─── Bileşen 4: Teslim Süresi Uyumu ──────────────────────────────────────
  private async calcDeliveryComplianceScore(vendorId: string): Promise<number> {
    const since = new Date();
    since.setMonth(since.getMonth() - 6);

    const [total, lateCount] = await Promise.all([
      this.prisma.appointment.count({
        where: { vendorId, scheduledAt: { gte: since } },
      }),
      this.prisma.appointment.count({
        where: {
          vendorId,
          scheduledAt: { gte: since },
          status: { in: ['cancelled', 'missed'] },
        },
      }),
    ]);

    if (total === 0) return 0;
    const lateRate = lateCount / total;
    return clamp(lateRate * 200); // %50 gecikme oranı → 100 puan
  }

  // ─── Bileşen 5: Toplu Yoğunlaşma ─────────────────────────────────────────
  private async calcConcentrationScore(vendorId: string): Promise<number> {
    const periodStart = new Date();
    periodStart.setMonth(periodStart.getMonth() - 3);

    const latestSnapshots = await this.prisma.vendorConcentrationSnapshot.findMany({
      where: {
        vendorId,
        periodStart: { gte: periodStart },
        isOverThreshold: true,
      },
    });

    if (latestSnapshots.length === 0) return 0;

    // En yüksek yoğunlaşma oranını kullan
    const maxConcentration = Math.max(...latestSnapshots.map((s) => s.concentrationPct));
    const thresholdPct = latestSnapshots[0].thresholdPct;

    // Eşiği aştığı kadar oran üzerinden puan
    const excess = Math.max(0, maxConcentration - thresholdPct);
    return clamp(excess * 2.5); // %40 aşım → 100 puan
  }

  // ─── Kompozit Skor ───────────────────────────────────────────────────────
  async calculateScore(vendorId: string): Promise<{
    components: RiskScoreComponents;
    totalScore: number;
    riskLevel: RiskLevel;
  }> {
    const [
      disputeRateScore,
      revisionFreqScore,
      priceDeviationScore,
      deliveryComplianceScore,
      concentrationScore,
    ] = await Promise.all([
      this.calcDisputeRateScore(vendorId),
      this.calcRevisionFreqScore(vendorId),
      this.calcPriceDeviationScore(vendorId),
      this.calcDeliveryComplianceScore(vendorId),
      this.calcConcentrationScore(vendorId),
    ]);

    const components: RiskScoreComponents = {
      disputeRateScore,
      revisionFreqScore,
      priceDeviationScore,
      deliveryComplianceScore,
      concentrationScore,
    };

    const totalScore = clamp(
      components.disputeRateScore * WEIGHTS.disputeRate +
        components.revisionFreqScore * WEIGHTS.revisionFreq +
        components.priceDeviationScore * WEIGHTS.priceDeviation +
        components.deliveryComplianceScore * WEIGHTS.deliveryCompliance +
        components.concentrationScore * WEIGHTS.concentration,
    );

    const riskLevel = toRiskLevel(totalScore);
    return { components, totalScore, riskLevel };
  }

  // ─── Skoru Kaydet / Güncelle ─────────────────────────────────────────────
  async recalculateAndSave(vendorId: string) {
    const { components, totalScore, riskLevel } = await this.calculateScore(vendorId);

    const [riskScore] = await Promise.all([
      this.prisma.vendorRiskScore.upsert({
        where: { vendorId },
        create: {
          vendorId,
          ...components,
          totalScore,
          riskLevel,
          calculatedAt: new Date(),
        },
        update: {
          ...components,
          totalScore,
          riskLevel,
          calculatedAt: new Date(),
        },
      }),
      this.prisma.vendorRiskScoreHistory.create({
        data: {
          vendorId,
          totalScore,
          riskLevel,
          snapshot: components as any,
        },
      }),
    ]);

    this.logger.log(
      `Vendor ${vendorId} risk score: ${totalScore.toFixed(1)} (${riskLevel})`,
    );

    return riskScore;
  }

  // ─── Tüm Tedarikçileri Yeniden Hesapla (Cron için) ───────────────────────
  async recalculateAll() {
    const vendors = await this.prisma.vendor.findMany({
      where: { status: 'active' },
      select: { id: true },
    });

    let updated = 0;
    for (const vendor of vendors) {
      try {
        await this.recalculateAndSave(vendor.id);
        updated++;
      } catch (err) {
        this.logger.error(`Failed to calculate risk score for vendor ${vendor.id}: ${err}`);
      }
    }

    this.logger.log(`Risk scores recalculated for ${updated}/${vendors.length} vendors`);
    return { updated, total: vendors.length };
  }

  // ─── Skor Özeti Listesi ───────────────────────────────────────────────────
  async findAllScores(params: {
    page?: number;
    limit?: number;
    riskLevel?: string;
    search?: string;
  }) {
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.riskLevel) where.riskLevel = params.riskLevel;

    const vendorWhere: any = {};
    if (params.search) {
      vendorWhere.name = { contains: params.search, mode: 'insensitive' };
    }

    const [rows, total] = await Promise.all([
      this.prisma.vendorRiskScore.findMany({
        where: {
          ...where,
          vendor: vendorWhere,
        },
        skip,
        take: limit,
        orderBy: { totalScore: 'desc' },
        include: {
          vendor: {
            select: { id: true, name: true, type: true, city: true, status: true },
          },
        },
      }),
      this.prisma.vendorRiskScore.count({
        where: { ...where, vendor: vendorWhere },
      }),
    ]);

    return { data: rows, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findScoreByVendor(vendorId: string) {
    const score = await this.prisma.vendorRiskScore.findUnique({
      where: { vendorId },
      include: {
        vendor: { select: { id: true, name: true, type: true, city: true } },
      },
    });
    return score;
  }

  async getScoreHistory(vendorId: string, limit = 30) {
    return this.prisma.vendorRiskScoreHistory.findMany({
      where: { vendorId },
      orderBy: { calculatedAt: 'desc' },
      take: limit,
    });
  }

  // ─── Yoğunlaşma Snapshot Güncelleme ─────────────────────────────────────
  async updateConcentrationSnapshot(workGroupId: string) {
    const periodEnd = new Date();
    const periodStart = new Date();
    periodStart.setMonth(periodStart.getMonth() - 3);

    // WorkGroup için tüm iş kalemlerini çek
    const items = await this.prisma.repairReportItem.findMany({
      where: {
        workGroupId,
        createdAt: { gte: periodStart, lte: periodEnd },
      },
      select: {
        supplierTotal: true,
        report: {
          select: {
            claimFile: {
              select: {
                costEntries: {
                  where: { vendorId: { not: null } },
                  select: { vendorId: true },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    // Tedarikçi bazında toplam hesapla
    const vendorTotals = new Map<string, { amount: number; count: number }>();
    let totalAmount = 0;
    let totalCount = 0;

    for (const item of items) {
      const vendorId = item.report.claimFile.costEntries[0]?.vendorId;
      if (!vendorId) continue;

      const current = vendorTotals.get(vendorId) || { amount: 0, count: 0 };
      vendorTotals.set(vendorId, {
        amount: current.amount + item.supplierTotal,
        count: current.count + 1,
      });
      totalAmount += item.supplierTotal;
      totalCount++;
    }

    const THRESHOLD = 60;
    const snapshots = [];

    for (const [vendorId, stats] of vendorTotals.entries()) {
      const concentrationPct = totalAmount > 0 ? (stats.amount / totalAmount) * 100 : 0;
      const snapshot = await this.prisma.vendorConcentrationSnapshot.create({
        data: {
          vendorId,
          workGroupId,
          periodStart,
          periodEnd,
          vendorJobCount: stats.count,
          totalJobCount: totalCount,
          vendorAmount: stats.amount,
          totalAmount,
          concentrationPct,
          isOverThreshold: concentrationPct >= THRESHOLD,
          thresholdPct: THRESHOLD,
        },
      });
      snapshots.push(snapshot);
    }

    return snapshots;
  }

  async getConcentrationAnalysis(workGroupId?: string) {
    const periodStart = new Date();
    periodStart.setMonth(periodStart.getMonth() - 3);

    const where: any = {
      periodStart: { gte: periodStart },
      isOverThreshold: true,
    };
    if (workGroupId) where.workGroupId = workGroupId;

    return this.prisma.vendorConcentrationSnapshot.findMany({
      where,
      include: {
        vendor: { select: { id: true, name: true, city: true } },
        workGroup: { select: { id: true, code: true, name: true } },
      },
      orderBy: { concentrationPct: 'desc' },
    });
  }
}
