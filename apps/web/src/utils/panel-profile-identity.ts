export type PanelProfileScopeEntry =
  | string
  | {
      name?: string | null;
      shortName?: string | null;
    };

export type PanelProfileUser = {
  firstName?: string | null;
  lastName?: string | null;
  jobTitle?: string | null;
  customerShortName?: string | null;
  assistantCustomerScopes?: PanelProfileScopeEntry[] | null;
  insuranceCompanyScopes?: PanelProfileScopeEntry[] | null;
};

function firstNamedScope(
  scopes: PanelProfileScopeEntry[] | undefined | null,
  chipField: 'short' | 'name',
): { chip: string; full: string } {
  if (!scopes?.length) return { chip: '', full: '' };
  for (const entry of scopes) {
    if (typeof entry === 'string') {
      const text = entry.trim();
      if (text) return { chip: text, full: text };
      continue;
    }
    const full = String(entry?.name ?? '').trim();
    const short = String(entry?.shortName ?? '').trim();
    if (chipField === 'short') {
      if (short) return { chip: short, full: full || short };
      if (full) return { chip: '', full };
      continue;
    }
    if (full || short) return { chip: full || short, full: full || short };
  }
  return { chip: '', full: '' };
}

const COMPANY_WORD_SURNAME = /^(asistans|asistan|sigorta|eksper|broker)$/i;

export function panelProfilePersonName(user?: PanelProfileUser | null): string {
  const first = String(user?.firstName ?? '').trim();
  const last = String(user?.lastName ?? '').trim();
  if (!last || COMPANY_WORD_SURNAME.test(last)) return first;
  return `${first} ${last}`.replace(/\s+/g, ' ').trim();
}

/**
 * Üst bant kimliği: satır 1 müşteri / kurum, satır 2 ad soyad.
 * Firma kullanıcısında yazılım unvanı (Meridyen) basılmaz.
 */
export function resolvePanelProfileIdentity(input: {
  isAssistanceCompanyUser?: boolean;
  isInsuranceCompanyUser?: boolean;
  user?: PanelProfileUser | null;
  organizationName?: string | null;
}): {
  customerChip: string;
  customerFull: string;
  personName: string;
  writtenDuty: string;
} {
  const personName = panelProfilePersonName(input.user);
  const writtenDuty = String(input.user?.jobTitle ?? '').trim();
  const organizationName = String(input.organizationName ?? '').trim();

  if (input.isAssistanceCompanyUser) {
    const writtenShort = String(input.user?.customerShortName ?? '').trim();
    const fromScope = firstNamedScope(input.user?.assistantCustomerScopes, 'short');
    const chip = writtenShort || fromScope.chip;
    return {
      customerChip: chip,
      customerFull: fromScope.full || chip,
      personName,
      writtenDuty,
    };
  }

  if (input.isInsuranceCompanyUser) {
    const fromScope = firstNamedScope(input.user?.insuranceCompanyScopes, 'name');
    return {
      customerChip: fromScope.chip,
      customerFull: fromScope.full || fromScope.chip,
      personName,
      writtenDuty,
    };
  }

  return {
    customerChip: organizationName,
    customerFull: organizationName,
    personName,
    writtenDuty,
  };
}
