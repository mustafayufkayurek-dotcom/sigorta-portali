/** Eksper portalını kullanan roller — broker aynı yüzü, firma ünvanı ile açar. */
export function normalizePortalRoleCode(roleCode?: string | null): string {
  return String(roleCode ?? '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_')
    .replace(/\s+/g, '_');
}

export function isExpertPortalRole(roleCode?: string | null): boolean {
  const role = normalizePortalRoleCode(roleCode);
  return role === 'expert' || role === 'adjuster' || role === 'broker_user';
}

export function isBrokerPortalRole(roleCode?: string | null): boolean {
  return normalizePortalRoleCode(roleCode) === 'broker_user';
}

export function expertPortalBrandLabel(roleCode?: string | null): string {
  return isBrokerPortalRole(roleCode) ? 'Broker Paneli' : 'Eksper Paneli';
}

export function expertPortalHomeTitle(roleCode?: string | null, firmTitle?: string | null): string {
  const firm = String(firmTitle ?? '').trim();
  if (isBrokerPortalRole(roleCode)) {
    return firm || 'Broker Paneli';
  }
  return firm || 'Eksper Paneli';
}
