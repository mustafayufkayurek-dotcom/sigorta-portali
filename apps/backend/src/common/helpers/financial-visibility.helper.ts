import { isFieldStaff } from './field-staff.helper';

export type FinancialVisibilityRoleKey = 'manager' | 'finance' | 'office_staff' | 'field_staff';
export type FinancialUserOverride = 'allow' | 'deny';

export type FinancialVisibilityRoleMode = 'all' | 'none' | 'custom';

export type FinancialVisibilityConfig = {
  roles: Record<FinancialVisibilityRoleKey, boolean>;
  userOverrides: Record<string, FinancialUserOverride>;
  /** all=rolün tamamı, none=rolün tamamı kapalı, custom=kişi bazlı (userOverrides) */
  roleModes?: Partial<Record<FinancialVisibilityRoleKey, FinancialVisibilityRoleMode>>;
};

export type FinancialVisibilityClaim = {
  hideFinancialFromAssignees?: boolean;
  financialVisibilityConfig?: unknown;
  assignedFieldUserId?: string | null;
  assignedOfficeUserId?: string | null;
  currentResponsibleUserId?: string | null;
};

export type FinancialVisibilityUser = {
  id: string;
  roleCode?: string | null;
};

export const DEFAULT_FINANCIAL_VISIBILITY_CONFIG: FinancialVisibilityConfig = {
  roles: {
    manager: true,
    finance: true,
    office_staff: true,
    field_staff: false,
  },
  userOverrides: {},
};

export function normalizeRoleCode(roleCode?: string | null): string | null {
  if (!roleCode) return null;
  return String(roleCode).trim().toLowerCase().replace(/\s+/g, '_');
}

/** Dosya finans ayarını yönetebilen roller */
export function canManageFinancialVisibility(roleCode?: string | null): boolean {
  const code = normalizeRoleCode(roleCode);
  return code === 'admin' || code === 'manager' || code === 'ops_manager';
}

/** Ayarı yapan yönetici/admin — kendi finansını her zaman görür */
export function isFinancialConfiguratorRole(roleCode?: string | null): boolean {
  return canManageFinancialVisibility(roleCode);
}

export function getFinancialRoleBucket(roleCode?: string | null): FinancialVisibilityRoleKey | null {
  const code = normalizeRoleCode(roleCode);
  if (!code) return null;
  if (['admin', 'manager', 'ops_manager'].includes(code)) return 'manager';
  if (['finance', 'finans', 'accountant'].includes(code)) return 'finance';
  if (code === 'office_staff') return 'office_staff';
  if (code === 'field_staff') return 'field_staff';
  return null;
}

export function normalizeFinancialVisibilityConfig(raw: unknown): FinancialVisibilityConfig {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Partial<FinancialVisibilityConfig>;
  const roles = (source.roles && typeof source.roles === 'object' ? source.roles : {}) as Partial<
    Record<FinancialVisibilityRoleKey, boolean>
  >;
  const userOverrides = (source.userOverrides && typeof source.userOverrides === 'object'
    ? source.userOverrides
    : {}) as Record<string, FinancialUserOverride>;
  const roleModesRaw = (source.roleModes && typeof source.roleModes === 'object'
    ? source.roleModes
    : {}) as Partial<Record<FinancialVisibilityRoleKey, FinancialVisibilityRoleMode>>;

  const cleanedOverrides: Record<string, FinancialUserOverride> = {};
  for (const [userId, value] of Object.entries(userOverrides)) {
    if (value === 'allow' || value === 'deny') cleanedOverrides[userId] = value;
  }

  const cleanedRoleModes: Partial<Record<FinancialVisibilityRoleKey, FinancialVisibilityRoleMode>> = {};
  for (const key of ['manager', 'finance', 'office_staff', 'field_staff'] as FinancialVisibilityRoleKey[]) {
    const mode = roleModesRaw[key];
    if (mode === 'all' || mode === 'none' || mode === 'custom') cleanedRoleModes[key] = mode;
  }

  return {
    roles: {
      manager: roles.manager ?? DEFAULT_FINANCIAL_VISIBILITY_CONFIG.roles.manager,
      finance: roles.finance ?? DEFAULT_FINANCIAL_VISIBILITY_CONFIG.roles.finance,
      office_staff: roles.office_staff ?? DEFAULT_FINANCIAL_VISIBILITY_CONFIG.roles.office_staff,
      field_staff: roles.field_staff ?? DEFAULT_FINANCIAL_VISIBILITY_CONFIG.roles.field_staff,
    },
    userOverrides: cleanedOverrides,
    roleModes: Object.keys(cleanedRoleModes).length > 0 ? cleanedRoleModes : undefined,
  };
}

export function resolveFinancialVisibilityConfig(file: FinancialVisibilityClaim): FinancialVisibilityConfig {
  if (file.financialVisibilityConfig != null) {
    return normalizeFinancialVisibilityConfig(file.financialVisibilityConfig);
  }
  if (file.hideFinancialFromAssignees) {
    return {
      roles: {
        manager: true,
        finance: true,
        office_staff: false,
        field_staff: false,
      },
      userOverrides: {},
      roleModes: { office_staff: 'none', field_staff: 'none' },
    };
  }
  return normalizeFinancialVisibilityConfig(DEFAULT_FINANCIAL_VISIBILITY_CONFIG);
}

export function isFileAssignee(user: FinancialVisibilityUser, file: FinancialVisibilityClaim): boolean {
  if (!user?.id) return false;
  return (
    user.id === file.assignedFieldUserId
    || user.id === file.assignedOfficeUserId
    || user.id === file.currentResponsibleUserId
  );
}

/** Dosya bazlı ciro/kârlılık görünürlüğü */
export function canViewFileFinancials(
  user: FinancialVisibilityUser | null | undefined,
  file: FinancialVisibilityClaim | null | undefined,
): boolean {
  if (!user || !file) return false;
  if (isFinancialConfiguratorRole(user.roleCode)) return true;

  const config = resolveFinancialVisibilityConfig(file);

  if (user.id && config.userOverrides[user.id] === 'deny') return false;
  if (user.id && config.userOverrides[user.id] === 'allow') return true;

  const bucket = getFinancialRoleBucket(user.roleCode);
  if (bucket === 'office_staff' || bucket === 'field_staff') {
    const mode = config.roleModes?.[bucket];
    if (mode === 'custom' && user.id && isFileAssignee(user, file)) {
      return false;
    }
  }
  if (bucket) return config.roles[bucket] === true;

  if (isFieldStaff(user.roleCode)) return false;
  if (file.hideFinancialFromAssignees && isFileAssignee(user, file)) return false;
  return true;
}

export const FINANCIAL_SUMMARY_FIELDS = [
  'estimatedRevenue',
  'actualRevenue',
  'estimatedCost',
  'actualCost',
  'grossProfit',
  'grossMarginPct',
  'fileFeeRevenue',
  'extraWorkRevenue',
  'totalRevenue',
  'vendorCost',
  'fieldExpenseCost',
  'materialCost',
  'communicationCost',
  'otherVariableCost',
  'totalVariableCost',
  'overheadShare',
  'totalCost',
  'netProfit',
  'netMarginPct',
  'collectedFromInsurer',
  'collectedFromInsured',
  'totalCollected',
  'profitMargin',
  'profitAmount',
  'initialReserveAmount',
  'estimatedCostAmount',
  'approvedBudgetAmount',
  'actualCostAmount',
  'invoicedAmount',
  'collectedAmount',
  'totalSales',
  'totalSupplier',
  'grossProfit',
  'grossMarginPct',
  'netMarginPct',
];

function stripFinancialFieldsFromObject(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...obj, canViewFinancials: false };
  for (const key of FINANCIAL_SUMMARY_FIELDS) {
    if (key in result) delete result[key];
  }
  if ('financialSummary' in result) delete result.financialSummary;
  return result;
}

function looksLikeClaimFile(obj: Record<string, unknown>): boolean {
  return typeof obj.fileNo === 'string' && typeof obj.id === 'string';
}

/** API yanıtında dosya bazlı finans alanlarını maskele */
export function applyFinancialVisibility(data: unknown, user: FinancialVisibilityUser | null | undefined): unknown {
  if (!user || data === null || data === undefined) return data;

  if (Array.isArray(data)) {
    return data.map((item) => applyFinancialVisibility(item, user));
  }

  if (typeof data !== 'object') return data;

  const obj = data as Record<string, unknown>;
  let result: Record<string, unknown> = { ...obj };

  if (looksLikeClaimFile(obj)) {
    const allowed = canViewFileFinancials(user, obj as FinancialVisibilityClaim);
    result.canViewFinancials = allowed;
    if (!allowed) {
      result = stripFinancialFieldsFromObject(result);
    }
  } else if (obj.claimFile && typeof obj.claimFile === 'object') {
    const claimFile = obj.claimFile as Record<string, unknown>;
    const allowed = canViewFileFinancials(user, claimFile as FinancialVisibilityClaim);
    result.canViewFinancials = allowed;
    if (!allowed) {
      result = stripFinancialFieldsFromObject(result);
      if (result.claimFile && typeof result.claimFile === 'object') {
        result.claimFile = stripFinancialFieldsFromObject(result.claimFile as Record<string, unknown>);
      }
    }
  }

  for (const [key, value] of Object.entries(result)) {
    if (key === 'canViewFinancials') continue;
    if (value !== null && typeof value === 'object') {
      result[key] = applyFinancialVisibility(value, user);
    }
  }

  return result;
}
