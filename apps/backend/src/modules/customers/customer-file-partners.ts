import type { PrismaService } from '@/prisma/prisma.service';
import {
  isExpertOfficeSubType,
  sortFileRecognizedPartners,
  type FileRecognizedPartner,
} from '@sigorta/shared';
import {
  resolveInsuranceCompanyIdsForCustomer,
  type CustomerFileStatsParty,
} from './customer-file-stats';

function officeDisplayName(c: {
  shortName?: string | null;
  companyName?: string | null;
  fullName?: string | null;
}): string {
  return (c.shortName || c.companyName || c.fullName || '').trim();
}

async function insurersForExpertOffice(
  prisma: PrismaService,
  expertOfficeId: string,
): Promise<FileRecognizedPartner[]> {
  const grouped = await prisma.claimFile.groupBy({
    by: ['insuranceCompanyId'],
    where: {
      OR: [
        { repairReports: { some: { expertOfficeId } } },
        { assignedAdjuster: { portalCustomerId: expertOfficeId } },
      ],
    },
    _count: { _all: true },
  });
  if (!grouped.length) return [];
  const companies = await prisma.insuranceCompany.findMany({
    where: { id: { in: grouped.map((row) => row.insuranceCompanyId) } },
    select: { id: true, name: true },
  });
  const names = new Map(companies.map((c) => [c.id, c.name]));
  return sortFileRecognizedPartners(
    grouped.map((row) => ({
      id: row.insuranceCompanyId,
      name: (names.get(row.insuranceCompanyId) ?? '').trim(),
      kind: 'sigorta_sirketi' as const,
      fileCount: row._count._all,
    })),
  );
}

async function expertsForInsurance(
  prisma: PrismaService,
  insuranceIds: string[],
): Promise<FileRecognizedPartner[]> {
  if (!insuranceIds.length) return [];
  const byOffice = new Map<string, { name: string; fileCount: number }>();

  const reportGroups = await prisma.repairReport.groupBy({
    by: ['expertOfficeId'],
    where: {
      expertOfficeId: { not: null },
      claimFile: { insuranceCompanyId: { in: insuranceIds } },
    },
    _count: { _all: true },
  });
  const officeIds = reportGroups
    .map((row) => row.expertOfficeId)
    .filter((id): id is string => Boolean(id));
  if (officeIds.length) {
    const offices = await prisma.customer.findMany({
      where: { id: { in: officeIds } },
      select: { id: true, shortName: true, companyName: true, fullName: true },
    });
    const officeNames = new Map(offices.map((o) => [o.id, officeDisplayName(o)]));
    for (const row of reportGroups) {
      if (!row.expertOfficeId) continue;
      const name = officeNames.get(row.expertOfficeId) ?? '';
      const prev = byOffice.get(row.expertOfficeId);
      byOffice.set(row.expertOfficeId, {
        name: prev?.name || name,
        fileCount: (prev?.fileCount ?? 0) + row._count._all,
      });
    }
  }

  const adjusterGroups = await prisma.claimFile.groupBy({
    by: ['assignedAdjusterId'],
    where: {
      insuranceCompanyId: { in: insuranceIds },
      assignedAdjusterId: { not: null },
      assignedAdjuster: { portalCustomerId: { not: null } },
    },
    _count: { _all: true },
  });
  const userIds = adjusterGroups
    .map((row) => row.assignedAdjusterId)
    .filter((id): id is string => Boolean(id));
  if (userIds.length) {
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        portalCustomer: {
          select: { id: true, shortName: true, companyName: true, fullName: true, subType: true },
        },
      },
    });
    const userOffice = new Map(
      users
        .filter((u) => u.portalCustomer && isExpertOfficeSubType(u.portalCustomer.subType))
        .map((u) => [u.id, u.portalCustomer!]),
    );
    for (const row of adjusterGroups) {
      if (!row.assignedAdjusterId) continue;
      const office = userOffice.get(row.assignedAdjusterId);
      if (!office) continue;
      const prev = byOffice.get(office.id);
      byOffice.set(office.id, {
        name: prev?.name || officeDisplayName(office),
        fileCount: (prev?.fileCount ?? 0) + row._count._all,
      });
    }
  }

  return sortFileRecognizedPartners(
    [...byOffice.entries()].map(([id, row]) => ({
      id,
      name: row.name,
      kind: 'eksper_firmasi' as const,
      fileCount: row.fileCount,
    })),
  );
}

export async function resolveFileRecognizedPartners(
  prisma: PrismaService,
  customer: CustomerFileStatsParty,
): Promise<FileRecognizedPartner[]> {
  if (isExpertOfficeSubType(customer.subType)) {
    return insurersForExpertOffice(prisma, customer.id);
  }
  if (String(customer.subType ?? '').trim() === 'sigorta_sirketi') {
    const insuranceIds = await resolveInsuranceCompanyIdsForCustomer(prisma, customer);
    return expertsForInsurance(prisma, insuranceIds);
  }
  return [];
}
