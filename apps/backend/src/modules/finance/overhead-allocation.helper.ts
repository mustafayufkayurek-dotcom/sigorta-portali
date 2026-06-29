import { PrismaService } from '@/prisma/prisma.service';

export type AllocationTargetType = 'claim' | 'emergency';

export interface AllocationTarget {
  type: AllocationTargetType;
  id: string;
  label: string;
  fileType: 'hasar' | 'ozel_operasyon' | 'acil_yardim';
  fileTypeLabel: string;
  approvedBudget: number;
  totalRevenue: number;
}

const CONSULTANCY_PATTERN = /dan[iı]şmanl[iı]k|danismanlik|hiz-00007/i;

export function isConsultancyServiceType(serviceType: string | null | undefined): boolean {
  if (!serviceType) return false;
  return CONSULTANCY_PATTERN.test(serviceType);
}

function claimFileTypeLabel(subType: string | null | undefined): {
  fileType: AllocationTarget['fileType'];
  fileTypeLabel: string;
} {
  if (subType === 'private_customer') {
    return { fileType: 'ozel_operasyon', fileTypeLabel: 'Özel Operasyon' };
  }
  return { fileType: 'hasar', fileTypeLabel: 'Hasar' };
}

export async function loadActiveAllocationTargets(
  prisma: PrismaService,
  year: number,
  month: number,
): Promise<AllocationTarget[]> {
  const periodStart = new Date(year, month - 1, 1);
  const periodEnd = new Date(year, month, 0, 23, 59, 59, 999);

  const claimFiles = await prisma.claimFile.findMany({
    where: {
      createdAt: { lte: periodEnd },
      OR: [{ closedAt: null }, { closedAt: { gte: periodStart } }],
      AND: {
        OR: [
          { approvedBudgetAmount: { gt: 0 } },
          { budgetVersions: { some: { status: 'approved', totalAmount: { gt: 0 } } } },
        ],
      },
      NOT: {
        customer: {
          serviceType: { contains: 'Danışmanlık', mode: 'insensitive' },
        },
      },
    },
    select: {
      id: true,
      fileNo: true,
      approvedBudgetAmount: true,
      customer: { select: { subType: true, serviceType: true } },
      financialSummary: { select: { fileFeeRevenue: true, totalRevenue: true } },
    },
  });

  const emergencyCases = await prisma.emergencyCase.findMany({
    where: {
      fileDate: { lte: periodEnd },
      OR: [{ resolvedAt: null }, { resolvedAt: { gte: periodStart } }],
      NOT: {
        customer: {
          serviceType: { contains: 'Danışmanlık', mode: 'insensitive' },
        },
      },
    },
    select: {
      id: true,
      caseNo: true,
      customer: { select: { serviceType: true } },
      costEntries: {
        where: { entryType: 'gelir' },
        select: { amount: true },
      },
    },
  });

  const claimTargets: AllocationTarget[] = claimFiles
    .filter((f) => !isConsultancyServiceType(f.customer?.serviceType))
    .map((f) => {
      const { fileType, fileTypeLabel } = claimFileTypeLabel(f.customer?.subType);
      return {
        type: 'claim' as const,
        id: f.id,
        label: f.fileNo,
        fileType,
        fileTypeLabel,
        approvedBudget: f.approvedBudgetAmount ?? 0,
        totalRevenue: f.financialSummary?.totalRevenue ?? 0,
      };
    });

  const emergencyTargets: AllocationTarget[] = emergencyCases
    .filter((c) => !isConsultancyServiceType(c.customer?.serviceType))
    .map((c) => ({
      type: 'emergency' as const,
      id: c.id,
      label: c.caseNo,
      fileType: 'acil_yardim' as const,
      fileTypeLabel: 'Acil Yardım',
      approvedBudget: c.costEntries.reduce((s, e) => s + e.amount, 0),
      totalRevenue: c.costEntries.reduce((s, e) => s + e.amount, 0),
    }));

  return [...claimTargets, ...emergencyTargets];
}

export function computeAllocationWeights(
  targets: AllocationTarget[],
  method: 'equal' | 'proportional_revenue' | 'hybrid',
): Map<string, number> {
  const n = targets.length;
  const map = new Map<string, number>();
  if (n === 0) return map;

  const key = (t: AllocationTarget) => `${t.type}:${t.id}`;

  if (method === 'equal') {
    targets.forEach((t) => map.set(key(t), 1 / n));
    return map;
  }

  const totalRevenue = targets.reduce((s, t) => s + t.totalRevenue, 0);

  if (method === 'proportional_revenue') {
    targets.forEach((t) => {
      map.set(key(t), totalRevenue > 0 ? t.totalRevenue / totalRevenue : 1 / n);
    });
    return map;
  }

  targets.forEach((t) => {
    const equalShare = 1 / n;
    const proportionalShare = totalRevenue > 0 ? t.totalRevenue / totalRevenue : 1 / n;
    map.set(key(t), 0.5 * equalShare + 0.5 * proportionalShare);
  });

  return map;
}

export function allocationTargetKey(type: AllocationTargetType, id: string): string {
  return `${type}:${id}`;
}

export function monthPeriodBounds(year: number, month: number) {
  const periodStart = new Date(year, month - 1, 1);
  const periodEnd = new Date(year, month, 0, 23, 59, 59, 999);
  return { periodStart, periodEnd };
}

export function formatPeriodLabel(year: number, month: number): string {
  const names = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
  ];
  return `${names[month - 1] ?? month} ${year}`;
}
