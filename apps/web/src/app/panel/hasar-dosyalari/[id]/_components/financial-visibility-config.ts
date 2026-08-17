export type FinVisRoleKey = 'manager' | 'finance' | 'office_staff' | 'field_staff';
export type FinVisUserOverride = 'allow' | 'deny';
export type FinVisRoleMode = 'all' | 'none' | 'custom';
export type FinVisConfig = {
  roles: Record<FinVisRoleKey, boolean>;
  userOverrides: Record<string, FinVisUserOverride>;
  roleModes?: Partial<Record<FinVisRoleKey, FinVisRoleMode>>;
};

export const DEFAULT_FIN_VIS_CONFIG: FinVisConfig = {
  roles: { manager: true, finance: true, office_staff: true, field_staff: false },
  userOverrides: {},
};

export function resolveFinVisConfig(claim: any): FinVisConfig {
  if (claim?.financialVisibilityConfig?.roles) {
    const c = claim.financialVisibilityConfig;
    return {
      roles: { ...DEFAULT_FIN_VIS_CONFIG.roles, ...c.roles },
      userOverrides: { ...(c.userOverrides ?? {}) },
      roleModes: c.roleModes ? { ...c.roleModes } : undefined,
    };
  }
  if (claim?.hideFinancialFromAssignees) {
    return {
      roles: { manager: true, finance: true, office_staff: false, field_staff: false },
      userOverrides: {},
      roleModes: { office_staff: 'none', field_staff: 'none' },
    };
  }
  return { ...DEFAULT_FIN_VIS_CONFIG, userOverrides: {} };
}

export function collectOfficeAssignees(claim: any): { id: string; name: string; label: string }[] {
  const rows: { id: string; name: string; label: string }[] = [];
  const push = (user: any, label: string) => {
    if (!user?.id) return;
    if (rows.some((r) => r.id === user.id)) return;
    rows.push({
      id: user.id,
      name: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || '—',
      label,
    });
  };
  push(claim.assignedOfficeUser, 'Dosya sorumlusu');
  push(claim.currentResponsibleUser, 'Güncel sorumlu');
  return rows;
}

export function inferAssigneeRoleMode(
  roleKey: 'office_staff' | 'field_staff',
  config: FinVisConfig,
  assignees: { id: string }[],
): FinVisRoleMode {
  if (config.roleModes?.[roleKey]) return config.roleModes[roleKey]!;
  if (config.roles[roleKey]) return 'all';
  if (assignees.length === 0) return config.roles[roleKey] ? 'all' : 'none';
  if (assignees.some((a) => config.userOverrides[a.id])) return 'custom';
  return 'none';
}

function clearAssigneeOverrides(
  userOverrides: Record<string, FinVisUserOverride>,
  assignees: { id: string }[],
): Record<string, FinVisUserOverride> {
  const next = { ...userOverrides };
  for (const a of assignees) delete next[a.id];
  return next;
}

export function applyAssigneeDropdownChange(
  roleKey: 'office_staff' | 'field_staff',
  value: string,
  assignees: { id: string }[],
  config: FinVisConfig,
): FinVisConfig {
  const roleModes = { ...(config.roleModes ?? {}) };
  let userOverrides = clearAssigneeOverrides({ ...config.userOverrides }, assignees);
  const roles = { ...config.roles };

  if (value === 'all') {
    roles[roleKey] = true;
    roleModes[roleKey] = 'all';
    userOverrides = clearAssigneeOverrides(userOverrides, assignees);
  } else if (value === 'none') {
    roles[roleKey] = false;
    roleModes[roleKey] = 'none';
    userOverrides = clearAssigneeOverrides(userOverrides, assignees);
  } else if (value.startsWith('deny:')) {
    const id = value.slice(5);
    if (assignees.length === 1) {
      roles[roleKey] = false;
      roleModes[roleKey] = 'none';
      userOverrides = clearAssigneeOverrides(userOverrides, assignees);
    } else {
      roles[roleKey] = true;
      roleModes[roleKey] = 'custom';
      userOverrides[id] = 'deny';
    }
  } else if (value.startsWith('allow:')) {
    const id = value.slice(6);
    roles[roleKey] = false;
    roleModes[roleKey] = 'custom';
    userOverrides[id] = 'allow';
  }

  return { roles, roleModes, userOverrides };
}

export function assigneeCanViewFinans(
  assigneeId: string,
  roleKey: 'office_staff' | 'field_staff',
  config: FinVisConfig,
  assignees: { id: string }[],
): boolean {
  const mode = inferAssigneeRoleMode(roleKey, config, assignees);
  if (mode === 'all') return true;
  if (mode === 'none') return false;
  if (config.userOverrides[assigneeId] === 'allow') return true;
  if (config.userOverrides[assigneeId] === 'deny') return false;
  return false;
}

export function setAssigneeFinansView(
  assigneeId: string,
  canView: boolean,
  roleKey: 'office_staff' | 'field_staff',
  config: FinVisConfig,
  assignees: { id: string }[],
): FinVisConfig {
  if (assignees.length === 1) {
    return applyAssigneeDropdownChange(roleKey, canView ? 'all' : 'none', assignees, config);
  }
  return applyAssigneeDropdownChange(
    roleKey,
    canView ? `allow:${assigneeId}` : `deny:${assigneeId}`,
    assignees,
    config,
  );
}
