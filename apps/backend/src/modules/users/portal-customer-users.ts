import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '@/prisma/prisma.service';
import { resolveInsuranceCompanyIdsForCustomer } from '@/modules/customers/customer-file-stats';

export {
  PORTAL_CUSTOMER_SUB_TYPES,
  isPortalCustomerSubType,
  normalizePortalRoleCode,
  roleCodesForPortalCustomerSubType,
} from './portal-customer-subtypes';
export type { PortalCustomerSubType } from './portal-customer-subtypes';

/** Sigorta portal kapsamı müşteri kartındaki Ayarlar bağından gelir. */
export async function ensureInsuranceCompanyIdForCustomer(
  prisma: PrismaService,
  customer: {
    id: string;
    taxNumber?: string | null;
    companyName?: string | null;
    fullName?: string | null;
    shortName?: string | null;
    subType?: string | null;
    insuranceCompanyId?: string | null;
  },
): Promise<string> {
  const bound = customer.insuranceCompanyId?.trim();
  if (bound) return bound;

  const existing = await resolveInsuranceCompanyIdsForCustomer(prisma, customer);
  if (existing.length === 1) {
    try {
      await prisma.customer.update({
        where: { id: customer.id },
        data: { insuranceCompanyId: existing[0] },
      });
    } catch {
      /* başka kart aynı şirkete bağlıysa kayıt durur; davet yine o id ile gider */
    }
    return existing[0]!;
  }
  if (existing.length > 1) {
    const tax = customer.taxNumber?.trim();
    if (tax) {
      const byTax = await prisma.insuranceCompany.findFirst({
        where: { id: { in: existing }, taxNumber: tax },
        select: { id: true },
      });
      if (byTax) {
        try {
          await prisma.customer.update({
            where: { id: customer.id },
            data: { insuranceCompanyId: byTax.id },
          });
        } catch {
          /* benzersiz bağ çakışması */
        }
        return byTax.id;
      }
    }
  }

  throw new BadRequestException(
    'Bu kart Ayarlar’daki sigorta şirketine bağlı değil. Kartı açıp şirketi seçin.',
  );
}
