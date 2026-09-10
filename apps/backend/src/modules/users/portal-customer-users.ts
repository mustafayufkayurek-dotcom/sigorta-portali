import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '@/prisma/prisma.service';
import {
  partyNamesLikelyMatch,
  resolveInsuranceCompanyIdsForCustomer,
} from '@/modules/customers/customer-file-stats';

export {
  PORTAL_CUSTOMER_SUB_TYPES,
  isPortalCustomerSubType,
  normalizePortalRoleCode,
  roleCodesForPortalCustomerSubType,
} from './portal-customer-subtypes';
export type { PortalCustomerSubType } from './portal-customer-subtypes';

function slugInsuranceCode(name: string): string {
  const slug = name
    .toUpperCase()
    .replace(/[ÇçĞğİıÖöŞşÜü]/g, (c) => (
      { Ç: 'C', ç: 'C', Ğ: 'G', ğ: 'G', İ: 'I', ı: 'I', Ö: 'O', ö: 'O', Ş: 'S', ş: 'S', Ü: 'U', ü: 'U' }[c] ?? c
    ))
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 20);
  return slug || 'SIRKET';
}

/** Sigorta portal kapsamı müşteri kartından — vergi no / unvan, yoksa yeni şirket kaydı */
export async function ensureInsuranceCompanyIdForCustomer(
  prisma: PrismaService,
  customer: {
    id: string;
    taxNumber?: string | null;
    companyName?: string | null;
    fullName?: string | null;
    shortName?: string | null;
    subType?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
  },
): Promise<string> {
  const existing = await resolveInsuranceCompanyIdsForCustomer(prisma, customer);
  if (existing.length === 1) return existing[0]!;
  if (existing.length > 1) {
    const tax = customer.taxNumber?.trim();
    if (tax) {
      const byTax = await prisma.insuranceCompany.findFirst({
        where: { id: { in: existing }, taxNumber: tax },
        select: { id: true },
      });
      if (byTax) return byTax.id;
    }
    return existing[0]!;
  }

  const name = (customer.companyName ?? customer.fullName ?? customer.shortName ?? '').trim();
  if (!name) {
    throw new BadRequestException('Sigorta şirketi unvanı eksik. Kartı tamamlayıp tekrar deneyin.');
  }

  const allActive = await prisma.insuranceCompany.findMany({
    where: { status: 'active' },
    select: { id: true, name: true },
  });
  const nameMatch = allActive.find((row) => partyNamesLikelyMatch(row.name, name));
  if (nameMatch) return nameMatch.id;

  let code = slugInsuranceCode(customer.shortName?.trim() || name);
  let attempt = 0;
  while (await prisma.insuranceCompany.findUnique({ where: { code } })) {
    attempt += 1;
    code = `${slugInsuranceCode(name)}_${attempt}`;
  }

  const created = await prisma.insuranceCompany.create({
    data: {
      code,
      name,
      taxNumber: customer.taxNumber?.trim() || undefined,
      contactPhone: customer.phone?.trim() || undefined,
      contactEmail: customer.email?.trim() || undefined,
      address: customer.address?.trim() || undefined,
      status: 'active',
    },
    select: { id: true },
  });
  return created.id;
}
