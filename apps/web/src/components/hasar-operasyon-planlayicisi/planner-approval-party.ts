/**
 * Hasar onay gönderimi — ilgili müşteri = eksper ofisi (ihbarı yapan).
 * Sigorta şirketi takip bilgisidir; varsayılan onay muhatabı değildir.
 */

import { isExpertFirmCustomer } from '@sigorta/shared';

export const PLANNER_DEFAULT_APPROVAL_AUTHORITY = 'Eksper';

export type PlannerApprovalAuthority = 'Eksper' | 'Sigorta şirketi';

export type PlannerExpertOfficeSource = {
  customer?: {
    shortName?: string | null;
    companyName?: string | null;
    fullName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
    type?: string | null;
    entityType?: string | null;
    subType?: string | null;
  } | null;
  assignedAdjuster?: {
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    adjuster?: {
      name?: string | null;
      company?: string | null;
      email?: string | null;
      phone?: string | null;
    } | null;
  } | null;
};

export type PlannerExpertOffice = {
  name: string;
  email: string;
  phone: string;
};

export type PlannerApprovalParty = {
  kind: 'expert_office' | 'insurer';
  name: string;
  email: string;
};

function displayName(c: {
  shortName?: string | null;
  companyName?: string | null;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}): string {
  return (
    c.shortName?.trim() ||
    c.companyName?.trim() ||
    c.fullName?.trim() ||
    `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim()
  );
}

/**
 * Eksper ofisi — müşteri kartı (eksper_firmasi) veya eksper kaydı şirketi.
 * Sigorta şirketi adı / e-postası buraya asla düşmez.
 */
export function resolvePlannerExpertOffice(
  source: PlannerExpertOfficeSource | null | undefined,
): PlannerExpertOffice {
  const customer = source?.customer ?? null;
  if (isExpertFirmCustomer(customer)) {
    const name = displayName(customer!);
    if (name && name !== '—') {
      return {
        name,
        email: (customer?.email ?? '').trim(),
        phone: (customer?.phone ?? '').trim(),
      };
    }
  }

  const adj = source?.assignedAdjuster?.adjuster;
  const officeName = (adj?.company ?? adj?.name ?? '').trim();
  if (officeName) {
    return {
      name: officeName,
      email: (adj?.email ?? '').trim(),
      phone: (adj?.phone ?? '').trim(),
    };
  }

  return { name: '', email: '', phone: '' };
}

export function resolvePlannerApprovalParty(
  authority: string,
  input: {
    expertOfficeName: string;
    expertOfficeEmail: string;
    insurerName: string;
    insurerEmail: string;
  },
): PlannerApprovalParty {
  if (authority === 'Sigorta şirketi') {
    return {
      kind: 'insurer',
      name: (input.insurerName ?? '').trim(),
      email: (input.insurerEmail ?? '').trim(),
    };
  }
  return {
    kind: 'expert_office',
    name: (input.expertOfficeName ?? '').trim(),
    email: (input.expertOfficeEmail ?? '').trim(),
  };
}

export function plannerApprovalPartyLabel(party: PlannerApprovalParty): string {
  if (party.kind === 'insurer') {
    return party.name || 'Sigorta Şirketi Tanımlanmamış';
  }
  return party.name || 'Eksper Ofisi Tanımlanmamış';
}
