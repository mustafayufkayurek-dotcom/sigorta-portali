import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { VendorCostMemoryService } from '@/modules/vendor-cost-memory/vendor-cost-memory.service';
import {
  buildSupplierFallbackWhere,
  buildVendorNearbyWhere,
  normalizeLocationLabel,
  resolveProvinceDistrictIds,
} from '@/modules/claim-files/vendor-area-match.util';
import { resolveCityDistrictFromAddress } from '@/modules/operation-inbox/inbound-location.util';
import {
  resolveTerminology,
  vendorExpertiseMatchesHints,
  vendorExpertiseOverlapScore,
} from '@/modules/vendor-intelligence-profile/terminology-memory.helper';
import { isAcilVendorQualityWarning } from '@sigorta/shared';
import type {
  VendorOperationMetrics,
  VendorRecommendationItem,
  VendorRecommendQuery,
} from './vendor-recommendation.types';

/**
 * Tedarikçi öneri motoru — yalnızca Meridyen operasyon hafızası.
 * Harici (Google vb.) puanlama kullanılmaz.
 *
 * Karar zinciri: Hizmet Türü → Operasyon Grubu → Tedarikçi Uzmanlığı → Maliyet → Skor
 *
 * Skor formülü (spec ağırlıkları, 0–100 bileşenler):
 *   composite = 0.30×kalite + 0.22×maliyetHafızası + 0.18×müdahale
 *             + 0.10×tamamlama + 0.08×şikayet + 0.12×uzmanlık(Operasyon Grubu)
 *
 * Veri yoksa nötr 50 kullanılır; aday yine listelenebilir (zorunlu atama yok).
 */
@Injectable()
export class VendorRecommendationService {
  private readonly logger = new Logger(VendorRecommendationService.name);

  private static readonly WEIGHTS = {
    quality: 0.30,
    cost: 0.22,
    response: 0.18,
    completion: 0.10,
    complaint: 0.08,
    expertise: 0.12,
  } as const;

  /** Alternatif aramadan «yalnız bu dosya» kaydı — havuz önerisine girmez. */
  static readonly FILE_ONLY_VENDOR_NOTE = 'Yalnızca bu dosyada kullanım.';

  constructor(
    private readonly prisma: PrismaService,
    private readonly costMemory: VendorCostMemoryService,
  ) {}

  /** Tek tedarikçi operasyon hafızası — profil API için. */
  async getOperationMetrics(vendorId: string, category?: string): Promise<VendorOperationMetrics> {
    const map = await this.loadMetricsBatch([vendorId], category);
    return map.get(vendorId) ?? this.emptyMetrics();
  }

  async recommend(query: VendorRecommendQuery): Promise<VendorRecommendationItem[]> {
    const sortByName = query.sortBy === 'name';
    const keepArea = Boolean(query.keepAllAreaCandidates);
    const limit = keepArea
      ? Math.min(Math.max(query.limit ?? 20, 1), 40)
      : sortByName
        ? Math.min(Math.max(query.limit ?? 80, 1), 80)
        : Math.min(Math.max(query.limit ?? 3, 1), 10);

    const terminology = query.serviceType?.trim()
      ? await resolveTerminology(this.prisma, query.serviceType)
      : null;
    const operationGroup =
      query.operationGroup
      ?? terminology?.operationGroup
      ?? terminology?.canonicalLabel
      ?? null;
    const canonicalLabel =
      query.canonicalLabel
      ?? terminology?.canonicalLabel
      ?? null;
    const originalServiceType =
      query.originalServiceType
      ?? terminology?.originalText
      ?? null;
    const expertiseHints =
      query.expertiseHints?.length
        ? query.expertiseHints
        : (terminology?.expertiseHints ?? []);
    const resolvedServiceType =
      operationGroup
      ?? terminology?.canonicalLabel
      ?? query.serviceType
      ?? query.category;

    const vendors = await this.findAreaCandidates({
      ...query,
      serviceType: resolvedServiceType ?? query.serviceType,
      expertiseHints,
    });
    if (vendors.length === 0) return [];

    const vendorIds = vendors.map((v) => v.id);
    const [metricsMap, memoryMap] = await Promise.all([
      this.loadMetricsBatch(vendorIds, query.category ?? query.serviceType),
      this.costMemory.getVendorSummaries({
        vendorIds,
        workGroupId: query.workGroupId,
        serviceType: resolvedServiceType ?? query.serviceType ?? query.category,
        city: normalizeLocationLabel(query.city) ?? undefined,
        district: normalizeLocationLabel(query.district) ?? undefined,
      }),
    ]);
    const scored = vendors.map((v) => {
      const m = metricsMap.get(v.id) ?? this.emptyMetrics();
      const memory = memoryMap.get(v.id);
      if (memory?.avgCost != null) {
        m.avgCost = memory.avgCost;
      }
      const expertiseTags = [
        v.category,
        ...v.workGroupNames,
        ...v.workGroupCodes,
        ...v.serviceBranches,
      ];
      const expertiseMatchScore = vendorExpertiseOverlapScore(expertiseTags, expertiseHints);
      return {
        vendor: v,
        metrics: m,
        costMemory: memory ?? null,
        expertiseMatchScore,
      };
    });

    const qualityVals = scored.map((s) => s.metrics.avgServiceScore).filter((v): v is number => v != null);
    const costVals = scored.map((s) => s.metrics.avgCost).filter((v): v is number => v != null);
    const responseVals = scored.map((s) => s.metrics.avgResponseTimeHours).filter((v): v is number => v != null);
    const completionVals = scored.map((s) => this.completionRate(s.metrics));
    const complaintVals = scored.map((s) => this.complaintScore(s.metrics));
    const expertiseVals = scored.map((s) => s.expertiseMatchScore);

    const withScore = scored.map(({ vendor, metrics, costMemory, expertiseMatchScore }) => {
      const qualityNorm = this.normHigher(
        metrics.avgServiceScore,
        qualityVals,
        (v) => ((v - 1) / 4) * 100,
      );
      const costNorm = this.normLower(metrics.avgCost, costVals);
      const responseNorm = this.normLower(metrics.avgResponseTimeHours, responseVals);
      const completionNorm = this.normHigher(this.completionRate(metrics), completionVals);
      const complaintNorm = this.normHigher(this.complaintScore(metrics), complaintVals);
      const expertiseNorm = this.normHigher(expertiseMatchScore, expertiseVals, (v) => v * 100);

      const compositeScore = Math.round(
        VendorRecommendationService.WEIGHTS.quality * qualityNorm
        + VendorRecommendationService.WEIGHTS.cost * costNorm
        + VendorRecommendationService.WEIGHTS.response * responseNorm
        + VendorRecommendationService.WEIGHTS.completion * completionNorm
        + VendorRecommendationService.WEIGHTS.complaint * complaintNorm
        + VendorRecommendationService.WEIGHTS.expertise * expertiseNorm,
      );

      return {
        id: vendor.id,
        name: vendor.name,
        phone: vendor.phone,
        city: vendor.city,
        district: vendor.district,
        avgServiceScore: metrics.avgServiceScore,
        avgCost: metrics.avgCost,
        avgResponseTime: metrics.avgResponseTimeHours,
        completedFileCount: metrics.completedFileCount,
        compositeScore: Math.max(0, Math.min(100, compositeScore)),
        costMemory: costMemory
          ? {
              ...costMemory,
              operationGroup: costMemory.operationGroup ?? operationGroup,
              canonicalLabel: costMemory.canonicalLabel ?? canonicalLabel,
              originalServiceType: costMemory.originalServiceType ?? originalServiceType,
            }
          : null,
        operationGroup,
        canonicalLabel,
        originalServiceType,
        expertiseMatchScore: Math.round(expertiseMatchScore * 100) / 100,
        qualityWarning: (query.category === 'acil' || query.keepAllAreaCandidates)
          ? isAcilVendorQualityWarning({
              avgServiceScore: metrics.avgServiceScore,
              compositeScore: Math.max(0, Math.min(100, compositeScore)),
              completedFileCount: metrics.completedFileCount,
            })
          : false,
      };
    });

    if (sortByName) {
      withScore.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
    } else {
      withScore.sort((a, b) => b.compositeScore - a.compositeScore);
    }
    return withScore.slice(0, limit).map((item, idx) => ({ ...item, rank: idx + 1 }));
  }

  async recommendForClaimFile(fileId: string, limit = 3): Promise<VendorRecommendationItem[]> {
    const file = await this.prisma.claimFile.findUnique({
      where: { id: fileId },
      include: {
        propertyAddress: true,
        claimSubject: { select: { id: true, name: true } },
      },
    });
    if (!file) throw new NotFoundException('Dosya bulunamadı.');

    let city = normalizeLocationLabel(file.propertyAddress?.city);
    let district = normalizeLocationLabel(file.propertyAddress?.district);
    const addressLine = file.propertyAddress?.addressLine?.trim() || '';

    if ((!city || !district) && addressLine) {
      const parsed = await resolveCityDistrictFromAddress(this.prisma, addressLine);
      if (!city && parsed.city) city = parsed.city;
      if (!district && parsed.district) district = parsed.district;
    }

    const rawSubject = file.claimSubject?.name || file.lossType;
    const terminology = rawSubject
      ? await resolveTerminology(this.prisma, rawSubject)
      : null;
    const serviceType =
      terminology?.operationGroup
      ?? terminology?.canonicalLabel
      ?? file.claimSubject?.name
      ?? file.lossType
      ?? undefined;

    return this.recommend({
      city: city ?? undefined,
      district: district ?? undefined,
      category: 'hasar',
      serviceType,
      operationGroup: terminology?.operationGroup ?? null,
      canonicalLabel: terminology?.canonicalLabel ?? null,
      originalServiceType: terminology?.originalText ?? rawSubject ?? null,
      expertiseHints: terminology?.expertiseHints ?? [],
      limit,
    });
  }

  async recommendForEmergencyCase(caseId: string, limit = 20): Promise<VendorRecommendationItem[]> {
    const emergencyCase = await this.prisma.emergencyCase.findUnique({ where: { id: caseId } });
    if (!emergencyCase) throw new NotFoundException('Acil dosya bulunamadı.');

    let city = normalizeLocationLabel(emergencyCase.city);
    let district = normalizeLocationLabel(emergencyCase.district);
    const addressLine = emergencyCase.address?.trim() || '';
    if ((!city || !district) && addressLine) {
      const parsed = await resolveCityDistrictFromAddress(this.prisma, addressLine);
      if (!city && parsed.city) city = parsed.city;
      if (!district && parsed.district) district = parsed.district;
    }

    const terminology = await resolveTerminology(this.prisma, emergencyCase.issueType);
    const serviceType =
      terminology.operationGroup
      ?? terminology.canonicalLabel
      ?? emergencyCase.issueType;

    // Acil: il/ilçe kayıtlı havuzun tamamı skorlanır. Uzmanlık süzgeci adayı düşürmez.
    return this.recommend({
      city: city ?? undefined,
      district: district ?? undefined,
      serviceType,
      operationGroup: terminology.operationGroup,
      canonicalLabel: terminology.canonicalLabel,
      originalServiceType: terminology.originalText || emergencyCase.issueType || null,
      expertiseHints: terminology.expertiseHints ?? [],
      category: 'acil',
      sortBy: 'score',
      allowNationalFallback: false,
      keepAllAreaCandidates: true,
      limit,
    });
  }

  /**
   * Öğrenen sistem kancası — dosya kapanınca metrikler bir sonraki öneride otomatik yansır.
   * Kalıcı önbellek tablosu yok; mevcut veriden canlı hesaplanır.
   */
  async onClaimFileClosed(claimFileId: string): Promise<void> {
    const file = await this.prisma.claimFile.findUnique({
      where: { id: claimFileId },
      select: {
        id: true,
        fileNo: true,
        assignedSupplierId: true,
        supplierAssignments: { select: { vendorId: true } },
      },
    });
    if (!file) return;

    const vendorIds = [
      ...new Set([
        ...(file.assignedSupplierId ? [file.assignedSupplierId] : []),
        ...file.supplierAssignments.map((l) => l.vendorId),
      ]),
    ];
    if (vendorIds.length === 0) return;

    await this.costMemory.recordClaimFileClosed(claimFileId);

    const metrics = await this.loadMetricsBatch(vendorIds);
    for (const vendorId of vendorIds) {
      const m = metrics.get(vendorId);
      this.logger.log(
        `[VendorRecommendation] Dosya kapandı — file=${file.fileNo} vendor=${vendorId} `
        + `tamamlanan=${m?.completedFileCount ?? 0} kalite=${m?.avgServiceScore?.toFixed(2) ?? '—'}`,
      );
    }
  }

  /** Acil dosya çözüldüğünde aynı canlı metrik güncellemesi. */
  async onEmergencyCaseResolved(emergencyCaseId: string): Promise<void> {
    const emergencyCase = await this.prisma.emergencyCase.findUnique({
      where: { id: emergencyCaseId },
      select: { caseNo: true, assignedVendorId: true },
    });
    if (!emergencyCase?.assignedVendorId) return;

    await this.costMemory.recordEmergencyCaseClosed(emergencyCaseId);

    const metrics = await this.loadMetricsBatch([emergencyCase.assignedVendorId], 'acil');
    const m = metrics.get(emergencyCase.assignedVendorId);
    this.logger.log(
      `[VendorRecommendation] Acil dosya çözüldü — case=${emergencyCase.caseNo} `
      + `vendor=${emergencyCase.assignedVendorId} tamamlanan=${m?.completedFileCount ?? 0}`,
    );
  }

  private async findAreaCandidates(query: VendorRecommendQuery & { expertiseHints?: string[] }) {
    const city = normalizeLocationLabel(query.city);
    const districtName = normalizeLocationLabel(query.district);
    const skipNational = query.allowNationalFallback === false;
    if (skipNational && !city && !query.provinceId) {
      return [];
    }

    let provinceId = query.provinceId ?? null;
    let districtId: string | null = null;
    if (!provinceId && city) {
      const resolved = await resolveProvinceDistrictIds(this.prisma, city, districtName);
      provinceId = resolved.provinceId;
      districtId = resolved.districtId;
      // Resmi il adı — "Afyon" kaydı "Afyonkarahisar" hizmet bölgesiyle eşleşsin.
      if (resolved.provinceName) city = resolved.provinceName;
      if (!districtName && resolved.districtName) districtName = resolved.districtName;
    }

    const where = buildVendorNearbyWhere({
      provinceId,
      // Acil: ildeki kayıtlı havuzun tamamı; ilçe satırı tedarikçiyi düşürmez.
      districtId: query.keepAllAreaCandidates ? null : districtId,
      city,
      districtName,
      purpose: 'supplier',
    });

    const categoryFilter = this.resolveCategoryFilter(query.category);
    if (categoryFilter) {
      where.category = { in: categoryFilter };
    }
    if (query.workGroupId) {
      where.vendorWorkGroups = { some: { workGroupId: query.workGroupId } };
    }
    where.NOT = [
      ...(Array.isArray(where.NOT) ? where.NOT : where.NOT ? [where.NOT] : []),
      { notes: { contains: VendorRecommendationService.FILE_ONLY_VENDOR_NOTE } },
    ];

    const vendorSelect = {
      id: true,
      name: true,
      phone: true,
      city: true,
      district: true,
      category: true,
      serviceBranches: true,
      vendorWorkGroups: {
        select: {
          workGroup: { select: { code: true, name: true } },
        },
      },
    } as const;

    let rows = await this.prisma.vendor.findMany({
      where,
      select: vendorSelect,
      take: 80,
      orderBy: { name: 'asc' },
    });

    const allowNational = query.allowNationalFallback !== false;

    // Bölgede aday yoksa — Hasar: aynı kategori ulusal havuz. Acil: boş (alternatif arama UI).
    if (rows.length === 0 && categoryFilter && allowNational) {
      const fallbackWhere = buildSupplierFallbackWhere(categoryFilter);
      if (query.workGroupId) {
        fallbackWhere.vendorWorkGroups = { some: { workGroupId: query.workGroupId } };
      }
      rows = await this.prisma.vendor.findMany({
        where: fallbackWhere,
        select: vendorSelect,
        take: 80,
        orderBy: { name: 'asc' },
      });
      if (rows.length > 0) {
        this.logger.warn(
          `[VendorRecommendation] Bölge eşleşmesi boş — aynı kategori ulusal havuz `
          + `city=${city ?? '—'} district=${districtName ?? '—'} category=${query.category ?? '—'} `
          + `count=${rows.length}`,
        );
      }
    }

    // Aynı ildeki kayıtlar önce gelsin (ulusal fallback sonrası karar kolaylığı)
    if (city && rows.length > 1) {
      const cityLower = city.toLocaleLowerCase('tr-TR');
      rows = [...rows].sort((a, b) => {
        const aCity = (a.city ?? '').toLocaleLowerCase('tr-TR') === cityLower ? 0 : 1;
        const bCity = (b.city ?? '').toLocaleLowerCase('tr-TR') === cityLower ? 0 : 1;
        if (aCity !== bCity) return aCity - bCity;
        return a.name.localeCompare(b.name, 'tr');
      });
    }

    const mapped = rows.map((v) => {
      const branches = Array.isArray(v.serviceBranches)
        ? (v.serviceBranches as unknown[]).map((b) => String(b))
        : [];
      return {
        id: v.id,
        name: v.name,
        phone: v.phone,
        city: v.city,
        district: v.district,
        category: v.category,
        serviceBranches: branches,
        workGroupNames: v.vendorWorkGroups.map((wg) => wg.workGroup.name),
        workGroupCodes: v.vendorWorkGroups.map((wg) => wg.workGroup.code),
      };
    });

    const hints = query.expertiseHints ?? [];
    if (!hints.length || query.keepAllAreaCandidates) return mapped;

    // Aynı Operasyon Grubu — uzmanlık eşleşen adaylar; eşleşme yoksa alan adaylarına düş.
    const inGroup = mapped.filter((v) =>
      vendorExpertiseMatchesHints(
        [v.category, ...v.workGroupNames, ...v.workGroupCodes, ...v.serviceBranches],
        hints,
      ),
    );
    return inGroup.length > 0 ? inGroup : mapped;
  }

  private resolveCategoryFilter(categoryOrService?: string): string[] | null {
    if (!categoryOrService?.trim()) return null;
    const v = categoryOrService.trim().toLowerCase();
    if (v === 'acil' || v === 'acil_yardim' || v === 'emergency') {
      return ['acil', 'her_ikisi'];
    }
    if (v === 'hasar' || v === 'damage') {
      return ['hasar', 'her_ikisi'];
    }
    return null;
  }

  private async loadMetricsBatch(
    vendorIds: string[],
    category?: string,
  ): Promise<Map<string, VendorOperationMetrics>> {
    if (vendorIds.length === 0) return new Map();

    const costWhere: { vendorId: { in: string[] }; category?: string } = { vendorId: { in: vendorIds } };
    if (category) costWhere.category = category;

    const [
      costAgg,
      completedByVendor,
      activeByVendor,
      disputeCounts,
      cancelledClaims,
      surveyRows,
      emergencySurveyRows,
      supplierLinks,
    ] = await Promise.all([
      this.prisma.costEntry.groupBy({
        by: ['vendorId'],
        where: { ...costWhere, vendorId: { in: vendorIds } },
        _avg: { amount: true },
        _count: { id: true },
      }),
      this.prisma.claimFileSupplier.groupBy({
        by: ['vendorId'],
        where: {
          vendorId: { in: vendorIds },
          claimFile: { currentStatus: { isClosedState: true } },
        },
        _count: { id: true },
      }),
      this.prisma.claimFileSupplier.groupBy({
        by: ['vendorId'],
        where: {
          vendorId: { in: vendorIds },
          claimFile: { currentStatus: { isClosedState: false } },
        },
        _count: { id: true },
      }),
      this.prisma.vendorStatementDispute.groupBy({
        by: ['vendorId'],
        where: { vendorId: { in: vendorIds } },
        _count: { id: true },
      }),
      this.prisma.claimFileSupplier.groupBy({
        by: ['vendorId'],
        where: {
          vendorId: { in: vendorIds },
          claimFile: { currentStatus: { code: 'cancelled' } },
        },
        _count: { id: true },
      }),
      this.prisma.surveyResponse.findMany({
        where: {
          campaign: {
            claimFile: {
              OR: [
                { assignedSupplierId: { in: vendorIds } },
                { supplierAssignments: { some: { vendorId: { in: vendorIds } } } },
              ],
            },
          },
        },
        select: {
          q1Rating: true,
          q2Rating: true,
          q3Rating: true,
          q4Rating: true,
          q5Rating: true,
          campaign: {
            select: {
              claimFile: {
                select: {
                  assignedSupplierId: true,
                  supplierAssignments: { select: { vendorId: true } },
                },
              },
            },
          },
        },
      }),
      this.prisma.surveyResponse.findMany({
        where: {
          campaign: {
            emergencyCaseId: { not: null },
          },
        },
        select: {
          q1Rating: true,
          q2Rating: true,
          q3Rating: true,
          q4Rating: true,
          q5Rating: true,
          campaign: { select: { emergencyCaseId: true } },
        },
      }),
      this.prisma.claimFileSupplier.findMany({
        where: { vendorId: { in: vendorIds } },
        select: {
          vendorId: true,
          claimFileId: true,
          assignedAt: true,
        },
        take: 500,
        orderBy: { assignedAt: 'desc' },
      }),
    ]);

    const responseTimes = await this.computeResponseTimes(supplierLinks);

    const map = new Map<string, VendorOperationMetrics>();
    for (const id of vendorIds) {
      map.set(id, this.emptyMetrics());
    }

    for (const row of costAgg) {
      if (!row.vendorId) continue;
      const cur = map.get(row.vendorId)!;
      cur.avgCost = row._avg.amount;
    }

    for (const row of completedByVendor) {
      const cur = map.get(row.vendorId)!;
      cur.completedFileCount = row._count.id;
    }

    for (const row of activeByVendor) {
      const cur = map.get(row.vendorId)!;
      cur.activeFileCount = row._count.id;
    }

    for (const row of disputeCounts) {
      const cur = map.get(row.vendorId)!;
      cur.disputeCount = row._count.id;
    }

    for (const row of cancelledClaims) {
      const cur = map.get(row.vendorId)!;
      cur.cancelledCaseCount = row._count.id;
    }

    const isAcil = this.resolveCategoryFilter(category)?.includes('acil') ?? false;
    if (isAcil) {
      const [emergencyCompleted, emergencyActive, emergencyCost] = await Promise.all([
        this.prisma.emergencyCase.groupBy({
          by: ['assignedVendorId'],
          where: {
            assignedVendorId: { in: vendorIds },
            status: { in: ['COZULDU', 'FATURALANDILDI'] },
          },
          _count: { id: true },
        }),
        this.prisma.emergencyCase.groupBy({
          by: ['assignedVendorId'],
          where: {
            assignedVendorId: { in: vendorIds },
            status: { in: ['GELEN', 'ATANDI', 'SAHADA'] },
          },
          _count: { id: true },
        }),
        this.prisma.emergencyCostEntry.groupBy({
          by: ['vendorId'],
          where: { vendorId: { in: vendorIds }, isOverhead: false },
          _avg: { amount: true },
        }),
      ]);
      for (const id of vendorIds) {
        const cur = map.get(id);
        if (!cur) continue;
        cur.completedFileCount = 0;
        cur.activeFileCount = 0;
        cur.avgCost = null;
      }
      for (const row of emergencyCompleted) {
        if (!row.assignedVendorId) continue;
        const cur = map.get(row.assignedVendorId);
        if (cur) cur.completedFileCount = row._count.id;
      }
      for (const row of emergencyActive) {
        if (!row.assignedVendorId) continue;
        const cur = map.get(row.assignedVendorId);
        if (cur) cur.activeFileCount = row._count.id;
      }
      for (const row of emergencyCost) {
        if (!row.vendorId) continue;
        const cur = map.get(row.vendorId);
        if (cur) cur.avgCost = row._avg.amount;
      }
    }

    for (const id of vendorIds) {
      const hours = responseTimes.get(id);
      if (hours != null) {
        map.get(id)!.avgResponseTimeHours = hours;
      }
    }

    const emergencyCaseIds = [
      ...new Set(
        emergencySurveyRows
          .map((r) => r.campaign.emergencyCaseId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const emergencyVendorByCase = emergencyCaseIds.length
      ? await this.prisma.emergencyCase.findMany({
          where: { id: { in: emergencyCaseIds }, assignedVendorId: { in: vendorIds } },
          select: { id: true, assignedVendorId: true },
        })
      : [];
    const emergencyVendorMap = new Map(
      emergencyVendorByCase
        .filter((c) => c.assignedVendorId)
        .map((c) => [c.id, c.assignedVendorId!]),
    );

    const surveyByVendor = new Map<string, number[]>();
    for (const row of surveyRows) {
      const rating = (row.q1Rating + row.q2Rating + row.q3Rating + row.q4Rating + row.q5Rating) / 5;
      const vendorSet = new Set<string>();
      const cf = row.campaign.claimFile;
      if (cf?.assignedSupplierId && vendorIds.includes(cf.assignedSupplierId)) {
        vendorSet.add(cf.assignedSupplierId);
      }
      for (const link of cf?.supplierAssignments ?? []) {
        if (vendorIds.includes(link.vendorId)) vendorSet.add(link.vendorId);
      }

      for (const vid of vendorSet) {
        const arr = surveyByVendor.get(vid) ?? [];
        arr.push(rating);
        surveyByVendor.set(vid, arr);
      }
    }
    for (const row of emergencySurveyRows) {
      const caseId = row.campaign.emergencyCaseId;
      if (!caseId) continue;
      const vendorId = emergencyVendorMap.get(caseId);
      if (!vendorId) continue;
      const rating = (row.q1Rating + row.q2Rating + row.q3Rating + row.q4Rating + row.q5Rating) / 5;
      const arr = surveyByVendor.get(vendorId) ?? [];
      arr.push(rating);
      surveyByVendor.set(vendorId, arr);
    }
    for (const [vid, ratings] of surveyByVendor) {
      const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
      map.get(vid)!.avgServiceScore = Math.round(avg * 100) / 100;
    }

    return map;
  }

  private async computeResponseTimes(
    links: Array<{ vendorId: string; claimFileId: string; assignedAt: Date }>,
  ): Promise<Map<string, number>> {
    const byVendor = new Map<string, number[]>();
    if (links.length === 0) return new Map();

    const fileIds = [...new Set(links.map((l) => l.claimFileId))];
    const [firstCosts, firstAppointments] = await Promise.all([
      this.prisma.costEntry.findMany({
        where: { claimFileId: { in: fileIds }, vendorId: { not: null } },
        select: { claimFileId: true, vendorId: true, entryDate: true },
        orderBy: { entryDate: 'asc' },
      }),
      this.prisma.appointment.findMany({
        where: { claimFileId: { in: fileIds }, vendorId: { not: null }, completedAt: { not: null } },
        select: { claimFileId: true, vendorId: true, completedAt: true },
        orderBy: { completedAt: 'asc' },
      }),
    ]);

    const firstIntervention = new Map<string, Date>();
    for (const c of firstCosts) {
      const key = `${c.claimFileId}:${c.vendorId}`;
      if (!firstIntervention.has(key)) firstIntervention.set(key, c.entryDate);
    }
    for (const a of firstAppointments) {
      const key = `${a.claimFileId}:${a.vendorId}`;
      if (!firstIntervention.has(key) && a.completedAt) firstIntervention.set(key, a.completedAt);
    }

    for (const link of links) {
      const key = `${link.claimFileId}:${link.vendorId}`;
      const intervention = firstIntervention.get(key);
      if (!intervention) continue;
      const hours = (intervention.getTime() - link.assignedAt.getTime()) / (1000 * 60 * 60);
      if (hours < 0) continue;
      const arr = byVendor.get(link.vendorId) ?? [];
      arr.push(hours);
      byVendor.set(link.vendorId, arr);
    }

    const result = new Map<string, number>();
    for (const [vendorId, hoursList] of byVendor) {
      const avg = hoursList.reduce((a, b) => a + b, 0) / hoursList.length;
      result.set(vendorId, Math.round(avg * 10) / 10);
    }
    return result;
  }

  private emptyMetrics(): VendorOperationMetrics {
    return {
      avgServiceScore: null,
      avgCost: null,
      avgResponseTimeHours: null,
      completedFileCount: 0,
      activeFileCount: 0,
      disputeCount: 0,
      cancelledCaseCount: 0,
    };
  }

  private completionRate(m: VendorOperationMetrics): number {
    const total = m.completedFileCount + m.activeFileCount;
    if (total === 0) return 0;
    return m.completedFileCount / total;
  }

  private penaltyRate(m: VendorOperationMetrics): number {
    const totalJobs = m.completedFileCount + m.activeFileCount + m.cancelledCaseCount;
    if (totalJobs === 0) return 0;
    return (m.disputeCount + m.cancelledCaseCount) / totalJobs;
  }

  /** Yüksek şikayet/iptal oranı düşük skor üretir; öneri formülünde ters çevrilir. */
  private complaintScore(m: VendorOperationMetrics): number {
    const penalty = this.penaltyRate(m);
    return Math.max(0, 1 - penalty);
  }

  private normHigher(
    value: number | null,
    pool: number[],
    transform?: (v: number) => number,
  ): number {
    if (value == null || pool.length === 0) return 50;
    const v = transform ? transform(value) : value;
    const poolT = transform ? pool.map(transform) : pool;
    const min = Math.min(...poolT);
    const max = Math.max(...poolT);
    if (max === min) return 50;
    return ((v - min) / (max - min)) * 100;
  }

  private normLower(value: number | null, pool: number[]): number {
    if (value == null || pool.length === 0) return 50;
    const min = Math.min(...pool);
    const max = Math.max(...pool);
    if (max === min) return 50;
    return ((max - value) / (max - min)) * 100;
  }
}
