import type { PrismaService } from '@/prisma/prisma.service';

export type CustomerFileStatsParty = {
  id: string;
  taxNumber?: string | null;
  companyName?: string | null;
  fullName?: string | null;
  shortName?: string | null;
  subType?: string | null;
};

export type CustomerFileStats = {
  total: number;
  open: number;
  closed: number;
  claim: number;
  emergency: number;
  lastActivity: Date | null;
};

/** Sigorta / asistan / broker kartı dosyayı çoğu zaman customerId ile tutmaz. */
export const INSURANCE_LINKED_SUB_TYPES = new Set([
  'sigorta_sirketi',
  'asistan_firmasi',
  'broker_firmasi',
]);

const CLOSED_EMERGENCY = ['COZULDU', 'FATURALANDILDI'] as const;

export function normalizePartyName(value: string | null | undefined): string {
  return (value ?? '')
    .trim()
    .toLocaleLowerCase('tr')
    .replace(/['.`]/g, '')
    .replace(/\b(a\.?\s*ş\.?|a\.?\s*s\.?|ltd\.?|şti\.?|sti\.?|assistance|asistans|asistan)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function partyNamesLikelyMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const na = normalizePartyName(a);
  const nb = normalizePartyName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 5 && nb.length >= 5 && (na.includes(nb) || nb.includes(na))) return true;
  return false;
}

export function customerPartyNames(c: CustomerFileStatsParty): string[] {
  return [c.companyName, c.fullName, c.shortName]
    .map((n) => n?.trim() ?? '')
    .filter(Boolean);
}

export function shouldLinkInsuranceCompany(c: CustomerFileStatsParty): boolean {
  return INSURANCE_LINKED_SUB_TYPES.has((c.subType ?? '').trim());
}

export function emptyCustomerFileStats(): CustomerFileStats {
  return { total: 0, open: 0, closed: 0, claim: 0, emergency: 0, lastActivity: null };
}

function laterDate(a: Date | null, b: Date | null): Date | null {
  if (!a) return b;
  if (!b) return a;
  return a.getTime() >= b.getTime() ? a : b;
}

export async function resolveInsuranceCompanyIdsForCustomer(
  prisma: PrismaService,
  customer: CustomerFileStatsParty,
): Promise<string[]> {
  if (!shouldLinkInsuranceCompany(customer) && !customer.taxNumber?.trim()) {
    return [];
  }

  const tax = customer.taxNumber?.trim();
  const companies = await prisma.insuranceCompany.findMany({
    where: tax
      ? { OR: [{ taxNumber: tax }, { status: 'active' }] }
      : { status: 'active' },
    select: { id: true, name: true, taxNumber: true },
  });

  const names = customerPartyNames(customer);
  const ids = new Set<string>();
  for (const company of companies) {
    if (tax && company.taxNumber?.trim() === tax) {
      ids.add(company.id);
      continue;
    }
    if (!shouldLinkInsuranceCompany(customer)) continue;
    if (names.some((n) => partyNamesLikelyMatch(n, company.name))) {
      ids.add(company.id);
    }
  }
  return [...ids];
}

export async function attachCustomerFileStats<T extends CustomerFileStatsParty>(
  prisma: PrismaService,
  customers: T[],
): Promise<Map<string, CustomerFileStats>> {
  const stats = new Map<string, CustomerFileStats>();
  for (const c of customers) stats.set(c.id, emptyCustomerFileStats());
  if (!customers.length) return stats;

  const ids = customers.map((c) => c.id);

  const [claimTotal, claimOpen, claimLast, emergencyTotal, emergencyOpen, emergencyLast] =
    await Promise.all([
      prisma.claimFile.groupBy({
        by: ['customerId'],
        where: { customerId: { in: ids } },
        _count: { _all: true },
      }),
      prisma.claimFile.groupBy({
        by: ['customerId'],
        where: { customerId: { in: ids }, currentStatus: { isClosedState: false } },
        _count: { _all: true },
      }),
      prisma.claimFile.groupBy({
        by: ['customerId'],
        where: { customerId: { in: ids } },
        _max: { updatedAt: true },
      }),
      prisma.emergencyCase.groupBy({
        by: ['customerId'],
        where: { customerId: { in: ids } },
        _count: { _all: true },
      }),
      prisma.emergencyCase.groupBy({
        by: ['customerId'],
        where: { customerId: { in: ids }, status: { notIn: CLOSED_EMERGENCY } },
        _count: { _all: true },
      }),
      prisma.emergencyCase.groupBy({
        by: ['customerId'],
        where: { customerId: { in: ids } },
        _max: { updatedAt: true },
      }),
    ]);

  const applyCount = (
    rows: { customerId: string | null; _count: { _all: number } }[],
    field: 'claim' | 'emergency' | 'openClaim' | 'openEmergency',
  ) => {
    for (const row of rows) {
      if (!row.customerId) continue;
      const current = stats.get(row.customerId);
      if (!current) continue;
      const n = row._count._all;
      if (field === 'claim') current.claim += n;
      if (field === 'emergency') current.emergency += n;
      if (field === 'openClaim' || field === 'openEmergency') current.open += n;
    }
  };

  applyCount(claimTotal, 'claim');
  applyCount(claimOpen, 'openClaim');
  applyCount(emergencyTotal, 'emergency');
  applyCount(emergencyOpen, 'openEmergency');

  for (const row of claimLast) {
    if (!row.customerId) continue;
    const current = stats.get(row.customerId);
    if (current) current.lastActivity = laterDate(current.lastActivity, row._max.updatedAt);
  }
  for (const row of emergencyLast) {
    if (!row.customerId) continue;
    const current = stats.get(row.customerId);
    if (current) current.lastActivity = laterDate(current.lastActivity, row._max.updatedAt);
  }

  const linkable = customers.filter(
    (c) => shouldLinkInsuranceCompany(c) || Boolean(c.taxNumber?.trim()),
  );
  if (linkable.length) {
    const companies = await prisma.insuranceCompany.findMany({
      select: { id: true, name: true, taxNumber: true },
    });
    const insuranceToCustomers = new Map<string, string[]>();

    for (const customer of linkable) {
      const tax = customer.taxNumber?.trim();
      const names = customerPartyNames(customer);
      for (const company of companies) {
        const taxHit = Boolean(tax && company.taxNumber?.trim() === tax);
        const nameHit =
          shouldLinkInsuranceCompany(customer)
          && names.some((n) => partyNamesLikelyMatch(n, company.name));
        if (!taxHit && !nameHit) continue;
        const owners = insuranceToCustomers.get(company.id) ?? [];
        owners.push(customer.id);
        insuranceToCustomers.set(company.id, owners);
      }
    }

    const insuranceIds = [...insuranceToCustomers.keys()];
    if (insuranceIds.length) {
      const [insTotal, insOpen, insLast] = await Promise.all([
        prisma.claimFile.groupBy({
          by: ['insuranceCompanyId', 'customerId'],
          where: { insuranceCompanyId: { in: insuranceIds } },
          _count: { _all: true },
        }),
        prisma.claimFile.groupBy({
          by: ['insuranceCompanyId', 'customerId'],
          where: {
            insuranceCompanyId: { in: insuranceIds },
            currentStatus: { isClosedState: false },
          },
          _count: { _all: true },
        }),
        prisma.claimFile.groupBy({
          by: ['insuranceCompanyId', 'customerId'],
          where: { insuranceCompanyId: { in: insuranceIds } },
          _max: { updatedAt: true },
        }),
      ]);

      const addInsurance = (
        rows: { insuranceCompanyId: string; customerId: string | null; _count?: { _all: number }; _max?: { updatedAt: Date | null } }[],
        mode: 'total' | 'open' | 'last',
      ) => {
        for (const row of rows) {
          const owners = insuranceToCustomers.get(row.insuranceCompanyId) ?? [];
          for (const ownerId of owners) {
            if (row.customerId === ownerId) continue;
            const current = stats.get(ownerId);
            if (!current) continue;
            if (mode === 'last') {
              current.lastActivity = laterDate(current.lastActivity, row._max?.updatedAt ?? null);
              continue;
            }
            const n = row._count?._all ?? 0;
            if (mode === 'total') current.claim += n;
            if (mode === 'open') current.open += n;
          }
        }
      };

      addInsurance(insTotal, 'total');
      addInsurance(insOpen, 'open');
      addInsurance(insLast, 'last');
    }
  }

  for (const current of stats.values()) {
    current.total = current.claim + current.emergency;
    current.closed = Math.max(0, current.total - current.open);
  }

  return stats;
}

export function applyCustomerFileStats<T extends CustomerFileStatsParty>(
  customer: T,
  stat: CustomerFileStats | undefined,
): T & {
  _count: { claimFiles: number; files: number; emergencyCases: number };
  _openCount: number;
  _closedCount: number;
} {
  const s = stat ?? emptyCustomerFileStats();
  const existingCount = (customer as { _count?: Record<string, number> })._count ?? {};
  return {
    ...customer,
    _count: {
      ...existingCount,
      claimFiles: s.total,
      files: s.total,
      emergencyCases: s.emergency,
    },
    _openCount: s.open,
    _closedCount: s.closed,
  };
}
