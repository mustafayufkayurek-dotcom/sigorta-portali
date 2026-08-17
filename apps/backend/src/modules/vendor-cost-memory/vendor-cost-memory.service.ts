import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import {
  buildServiceTypeMatchKeys,
  resolveTerminologySync,
  serviceTypeMatchesKeys,
} from '@/modules/vendor-intelligence-profile/terminology-memory.helper';
import type { VendorCostMemoryRecordInput, VendorCostMemorySummary } from './vendor-cost-memory.types';

const CLOSED_EMERGENCY_STATUSES = ['COZULDU', 'FATURALANDILDI'] as const;
const APPROVED_REPORT_STATUSES = ['approved', 'externally_approved'] as const;

type MemoryPoint = VendorCostMemoryRecordInput & {
  originalServiceType?: string | null;
  canonicalLabel?: string | null;
  canonicalSubjectId?: string | null;
  operationGroup?: string | null;
};

@Injectable()
export class VendorCostMemoryService {
  private readonly logger = new Logger(VendorCostMemoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  private monthsAgo(months: number): Date {
    const d = new Date();
    d.setMonth(d.getMonth() - months);
    return d;
  }

  private durationHours(start?: Date | null, end?: Date | null): number | null {
    if (!start || !end) return null;
    const ms = end.getTime() - start.getTime();
    if (ms <= 0) return null;
    return Math.round((ms / (1000 * 60 * 60)) * 10) / 10;
  }

  private buildLabel(count: number, workGroupName?: string | null, serviceType?: string | null): string {
    const subject = workGroupName?.trim() || serviceType?.trim() || 'İşlem';
    return `Son ${count} ${subject}`;
  }

  private annotateServiceType(raw?: string | null): Pick<
    MemoryPoint,
    'serviceType' | 'originalServiceType' | 'canonicalLabel' | 'canonicalSubjectId' | 'operationGroup'
  > {
    const original = raw?.trim() || null;
    const sync = resolveTerminologySync(original);
    const operationGroup = sync.operationGroup ?? sync.canonicalLabel ?? null;
    return {
      originalServiceType: original,
      canonicalLabel: sync.canonicalLabel,
      canonicalSubjectId: sync.canonicalSubjectId,
      operationGroup,
      serviceType: operationGroup ?? original,
    };
  }

  private summarize(points: MemoryPoint[], filters: {
    vendorId: string;
    workGroupId?: string;
    workGroupName?: string | null;
    serviceType?: string | null;
    canonicalLabel?: string | null;
    canonicalSubjectId?: string | null;
    operationGroup?: string | null;
    originalServiceType?: string | null;
    provinceName?: string | null;
  }): VendorCostMemorySummary | null {
    if (!points.length) return null;

    const costs = points.map((p) => p.actualCost).filter((v) => v > 0);
    if (!costs.length) return null;

    const sorted = [...points].sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime());
    const last = sorted[0];
    const durations = points.map((p) => p.durationHours).filter((v): v is number => v != null && v > 0);
    const avgDurationHours = durations.length
      ? Math.round((durations.reduce((s, v) => s + v, 0) / durations.length) * 10) / 10
      : null;

    const operationGroup =
      filters.operationGroup
      ?? filters.canonicalLabel
      ?? last.operationGroup
      ?? last.canonicalLabel
      ?? null;
    const canonicalLabel =
      filters.canonicalLabel
      ?? last.canonicalLabel
      ?? operationGroup
      ?? null;
    const displayType =
      filters.serviceType
      ?? operationGroup
      ?? canonicalLabel
      ?? last.serviceType
      ?? null;

    return {
      vendorId: filters.vendorId,
      serviceType: displayType,
      originalServiceType:
        filters.originalServiceType
        ?? last.originalServiceType
        ?? last.serviceType
        ?? null,
      canonicalLabel,
      canonicalSubjectId: filters.canonicalSubjectId ?? last.canonicalSubjectId ?? null,
      operationGroup,
      workGroupId: filters.workGroupId ?? last.workGroupId ?? null,
      workGroupName: filters.workGroupName ?? null,
      provinceName: filters.provinceName ?? last.provinceName ?? null,
      districtName: last.districtName ?? null,
      count: costs.length,
      avgCost: Math.round(costs.reduce((s, v) => s + v, 0) / costs.length),
      minCost: Math.min(...costs),
      maxCost: Math.max(...costs),
      lastCost: last.actualCost,
      lastDate: last.recordedAt.toISOString(),
      avgDurationHours,
      label: this.buildLabel(costs.length, filters.workGroupName, displayType),
    };
  }

  async collectMemoryPoints(params: {
    vendorIds: string[];
    workGroupId?: string;
    serviceType?: string;
    city?: string;
    district?: string;
    months?: number;
    limitPerVendor?: number;
  }): Promise<MemoryPoint[]> {
    const {
      vendorIds,
      workGroupId,
      serviceType,
      city,
      district,
      months = 12,
      limitPerVendor = 12,
    } = params;
    if (!vendorIds.length) return [];

    const since = this.monthsAgo(months);
    const cityFilter = city?.trim();
    const districtFilter = district?.trim();

    const match = serviceType?.trim()
      ? await buildServiceTypeMatchKeys(this.prisma, serviceType)
      : { keys: [] as string[], resolution: null as Awaited<ReturnType<typeof buildServiceTypeMatchKeys>>['resolution'] | null };
    const serviceTypeKeys = match.keys;
    const queryCanonical =
      match.resolution?.operationGroup
      ?? match.resolution?.canonicalLabel
      ?? null;
    const categoryFilter = serviceTypeKeys.length
      ? { OR: serviceTypeKeys.map((k) => ({ category: { equals: k, mode: 'insensitive' as const } })) }
      : {};
    const issueTypeFilter = serviceTypeKeys.length
      ? {
          OR: serviceTypeKeys.map((k) => ({
            issueType: { equals: k, mode: 'insensitive' as const },
          })),
        }
      : {};

    const [costEntries, emergencyEntries, repairItems, workGroup] = await Promise.all([
      this.prisma.costEntry.findMany({
        where: {
          vendorId: { in: vendorIds },
          amount: { gt: 0 },
          entryDate: { gte: since },
          ...categoryFilter,
          claimFile: {
            currentStatus: { isClosedState: true },
            ...(cityFilter
              ? { propertyAddress: { city: { equals: cityFilter, mode: 'insensitive' } } }
              : {}),
            ...(districtFilter
              ? { propertyAddress: { district: { equals: districtFilter, mode: 'insensitive' } } }
              : {}),
          },
        },
        select: {
          vendorId: true,
          category: true,
          amount: true,
          entryDate: true,
          claimFile: {
            select: {
              lossType: true,
              approvedBudgetAmount: true,
              closedAt: true,
              createdAt: true,
              supplierAssignedAt: true,
              propertyAddress: { select: { city: true, district: true } },
            },
          },
        },
        orderBy: { entryDate: 'desc' },
        take: vendorIds.length * limitPerVendor * 2,
      }),
      this.prisma.emergencyCostEntry.findMany({
        where: {
          vendorId: { in: vendorIds },
          amount: { gt: 0 },
          entryDate: { gte: since },
          case: {
            status: { in: [...CLOSED_EMERGENCY_STATUSES] },
            ...(cityFilter ? { city: { equals: cityFilter, mode: 'insensitive' } } : {}),
            ...(districtFilter ? { district: { equals: districtFilter, mode: 'insensitive' } } : {}),
            ...issueTypeFilter,
          },
        },
        select: {
          vendorId: true,
          amount: true,
          entryDate: true,
          case: {
            select: {
              issueType: true,
              city: true,
              district: true,
              fileDate: true,
              resolvedAt: true,
            },
          },
        },
        orderBy: { entryDate: 'desc' },
        take: vendorIds.length * limitPerVendor,
      }),
      workGroupId
        ? this.prisma.repairReportItem.findMany({
            where: {
              workGroupId,
              supplierTotal: { gt: 0 },
              report: {
                status: { in: [...APPROVED_REPORT_STATUSES] },
                claimFile: {
                  currentStatus: { isClosedState: true },
                  assignedSupplierId: { in: vendorIds },
                  closedAt: { gte: since },
                  ...(cityFilter
                    ? { propertyAddress: { city: { equals: cityFilter, mode: 'insensitive' } } }
                    : {}),
                },
              },
            },
            select: {
              supplierTotal: true,
              supplierUnitPrice: true,
              createdAt: true,
              report: {
                select: {
                  claimFile: {
                    select: {
                      assignedSupplierId: true,
                      lossType: true,
                      approvedBudgetAmount: true,
                      closedAt: true,
                      createdAt: true,
                      supplierAssignedAt: true,
                      propertyAddress: { select: { city: true, district: true } },
                    },
                  },
                },
              },
            },
            orderBy: { createdAt: 'desc' },
            take: vendorIds.length * limitPerVendor * 2,
          })
        : Promise.resolve([]),
      workGroupId
        ? this.prisma.workGroup.findUnique({ where: { id: workGroupId }, select: { name: true } })
        : Promise.resolve(null),
    ]);

    const points: MemoryPoint[] = [];

    for (const entry of costEntries) {
      if (!entry.vendorId) continue;
      const cf = entry.claimFile;
      const rawType = entry.category || cf.lossType;
      if (
        serviceTypeKeys.length
        && !serviceTypeMatchesKeys(rawType, serviceTypeKeys, queryCanonical)
        && !serviceTypeMatchesKeys(cf.lossType, serviceTypeKeys, queryCanonical)
      ) {
        continue;
      }
      const annotated = this.annotateServiceType(rawType);
      points.push({
        vendorId: entry.vendorId,
        ...annotated,
        workGroupId,
        provinceName: cf.propertyAddress?.city ?? null,
        districtName: cf.propertyAddress?.district ?? null,
        quotedCost: entry.amount,
        approvedCost: cf.approvedBudgetAmount ?? null,
        actualCost: entry.amount,
        durationHours: this.durationHours(cf.supplierAssignedAt ?? cf.createdAt, cf.closedAt),
        recordedAt: entry.entryDate,
      });
    }

    for (const entry of emergencyEntries) {
      if (!entry.vendorId) continue;
      const c = entry.case;
      if (
        serviceTypeKeys.length
        && !serviceTypeMatchesKeys(c.issueType, serviceTypeKeys, queryCanonical)
      ) {
        continue;
      }
      const annotated = this.annotateServiceType(c.issueType);
      points.push({
        vendorId: entry.vendorId,
        ...annotated,
        workGroupId,
        provinceName: c.city ?? null,
        districtName: c.district ?? null,
        quotedCost: entry.amount,
        approvedCost: entry.amount,
        actualCost: entry.amount,
        durationHours: this.durationHours(c.fileDate, c.resolvedAt),
        recordedAt: entry.entryDate,
      });
    }

    for (const item of repairItems) {
      const cf = item.report.claimFile;
      const vendorId = cf.assignedSupplierId;
      if (!vendorId) continue;
      if (
        serviceTypeKeys.length
        && !serviceTypeMatchesKeys(cf.lossType, serviceTypeKeys, queryCanonical)
      ) {
        continue;
      }
      const annotated = this.annotateServiceType(cf.lossType);
      points.push({
        vendorId,
        ...annotated,
        workGroupId,
        provinceName: cf.propertyAddress?.city ?? null,
        districtName: cf.propertyAddress?.district ?? null,
        quotedCost: item.supplierUnitPrice,
        approvedCost: cf.approvedBudgetAmount ?? null,
        actualCost: item.supplierTotal,
        durationHours: this.durationHours(cf.supplierAssignedAt ?? cf.createdAt, cf.closedAt),
        recordedAt: cf.closedAt ?? item.createdAt,
      });
    }

    if (workGroup?.name) {
      for (const p of points) {
        if (p.workGroupId === workGroupId) {
          (p as MemoryPoint & { workGroupName?: string }).workGroupName = workGroup.name;
        }
      }
    }

    const grouped = new Map<string, MemoryPoint[]>();
    for (const point of points) {
      const list = grouped.get(point.vendorId) ?? [];
      if (list.length < limitPerVendor) list.push(point);
      grouped.set(point.vendorId, list);
    }

    return Array.from(grouped.values()).flat();
  }

  async getVendorSummaries(params: {
    vendorIds: string[];
    workGroupId?: string;
    serviceType?: string;
    city?: string;
    district?: string;
    months?: number;
  }): Promise<Map<string, VendorCostMemorySummary>> {
    const { vendorIds, workGroupId, serviceType, city } = params;
    if (!vendorIds.length) return new Map();

    const [points, workGroup, match] = await Promise.all([
      this.collectMemoryPoints(params),
      workGroupId
        ? this.prisma.workGroup.findUnique({ where: { id: workGroupId }, select: { name: true } })
        : Promise.resolve(null),
      serviceType?.trim()
        ? buildServiceTypeMatchKeys(this.prisma, serviceType)
        : Promise.resolve(null),
    ]);

    const result = new Map<string, VendorCostMemorySummary>();
    for (const vendorId of vendorIds) {
      const vendorPoints = points.filter((p) => p.vendorId === vendorId);
      const operationGroup =
        match?.resolution.operationGroup
        ?? match?.resolution.canonicalLabel
        ?? null;
      const summary = this.summarize(vendorPoints, {
        vendorId,
        workGroupId,
        workGroupName: workGroup?.name ?? null,
        serviceType: operationGroup ?? serviceType ?? null,
        canonicalLabel: match?.resolution.canonicalLabel ?? null,
        canonicalSubjectId: match?.resolution.canonicalSubjectId ?? null,
        operationGroup,
        originalServiceType: match?.resolution.originalText || serviceType || null,
        provinceName: city,
      });
      if (summary) result.set(vendorId, summary);
    }
    return result;
  }

  async getVendorSummary(params: {
    vendorId: string;
    workGroupId?: string;
    serviceType?: string;
    city?: string;
    district?: string;
    months?: number;
  }): Promise<VendorCostMemorySummary | null> {
    const map = await this.getVendorSummaries({
      vendorIds: [params.vendorId],
      ...params,
    });
    return map.get(params.vendorId) ?? null;
  }

  /** Kapanış hook — mevcut tablolardan hafıza türetilir; ayrı tablo yok. */
  async recordClaimFileClosed(claimFileId: string): Promise<number> {
    const claim = await this.prisma.claimFile.findUnique({
      where: { id: claimFileId },
      select: {
        id: true,
        fileNo: true,
        lossType: true,
        assignedSupplierId: true,
        closedAt: true,
        propertyAddress: { select: { city: true, district: true } },
        costEntries: {
          where: { vendorId: { not: null }, amount: { gt: 0 } },
          select: { vendorId: true, amount: true, category: true },
        },
      },
    });
    if (!claim) return 0;

    const vendorIds = [
      ...new Set(
        claim.costEntries.map((e) => e.vendorId).filter((id): id is string => Boolean(id)),
      ),
    ];
    if (claim.assignedSupplierId) vendorIds.push(claim.assignedSupplierId);

    const uniqueVendorIds = [...new Set(vendorIds)];
    if (!uniqueVendorIds.length) {
      this.logger.debug(`[cost-memory] Kapanış — maliyet kaydı yok: ${claim.fileNo}`);
      return 0;
    }

    const summaries = await this.getVendorSummaries({
      vendorIds: uniqueVendorIds,
      serviceType: claim.lossType ?? undefined,
      city: claim.propertyAddress?.city ?? undefined,
      district: claim.propertyAddress?.district ?? undefined,
    });

    this.logger.log(
      `[cost-memory] Hasar dosyası kapanışı — ${claim.fileNo}: ${summaries.size} tedarikçi hafızası güncellendi`,
    );
    return summaries.size;
  }

  async recordEmergencyCaseClosed(caseId: string): Promise<number> {
    const emergencyCase = await this.prisma.emergencyCase.findUnique({
      where: { id: caseId },
      select: {
        caseNo: true,
        issueType: true,
        city: true,
        district: true,
        assignedVendorId: true,
        costEntries: {
          where: { vendorId: { not: null }, amount: { gt: 0 } },
          select: { vendorId: true },
        },
      },
    });
    if (!emergencyCase) return 0;

    const vendorIds = [
      ...new Set(
        emergencyCase.costEntries.map((e) => e.vendorId).filter((id): id is string => Boolean(id)),
      ),
    ];
    if (emergencyCase.assignedVendorId) vendorIds.push(emergencyCase.assignedVendorId);
    const uniqueVendorIds = [...new Set(vendorIds)];
    if (!uniqueVendorIds.length) return 0;

    const summaries = await this.getVendorSummaries({
      vendorIds: uniqueVendorIds,
      serviceType: emergencyCase.issueType,
      city: emergencyCase.city ?? undefined,
      district: emergencyCase.district ?? undefined,
    });

    this.logger.log(
      `[cost-memory] Acil yardım kapanışı — ${emergencyCase.caseNo}: ${summaries.size} tedarikçi hafızası güncellendi`,
    );
    return summaries.size;
  }
}
