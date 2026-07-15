/**
 * Dashboard rol layout registry — tek shell; rol sadece layout/widget setini seçer.
 * Yeni Dashboard ekranı yok; burada olmayan rol = default operational layout.
 */

export type DashboardLayoutId =
  | 'management'
  | 'office_staff'
  | 'field_staff'
  | 'expert_portal'
  | 'insurance_portal'
  | 'default';

/** Repo’da Dashboard’a gerçekten bağlanan roller (yeni rol Dashboard’u üretilmez). */
export const DASHBOARD_ROLE_LAYOUTS: Record<string, DashboardLayoutId> = {
  admin: 'management',
  manager: 'management',
  office_staff: 'office_staff',
  field_staff: 'field_staff',
  // finance / diğer operasyon roller → default (PrimaryKpi + flow + alerts)
  finance: 'default',
  finans: 'default',
  accountant: 'default',
  // Portal roller — aynı chrome (DashboardShell); widget seti portal route’ta
  expert: 'expert_portal',
  insurance_company_user: 'insurance_portal',
};

export type DashboardLayoutFlags = {
  layoutId: DashboardLayoutId;
  usesDashboardShell: true;
  showFinanceBand: boolean;
  showAcilInFlow: boolean;
};

export function resolveDashboardLayoutId(roleCode: string): DashboardLayoutId {
  const normalized = String(roleCode ?? '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_')
    .replace(/\s+/g, '_');
  return DASHBOARD_ROLE_LAYOUTS[normalized] ?? 'default';
}

/**
 * Panel access bayraklarından layout — page.tsx tek giriş noktası.
 * Portal roller ayrı route’ta (`/panel/eksper-portal`, `/panel/sigorta-portal`)
 * ama aynı SHARED_DASHBOARD_SHELL sözleşmesini kullanır.
 */
export function resolveDashboardLayout(access: {
  roleCode: string;
  isManagement: boolean;
  isOfficeStaff: boolean;
  isFieldStaff: boolean;
  showFinanceWidgets: boolean;
  showAcilYardim: boolean;
}): DashboardLayoutFlags {
  let layoutId: DashboardLayoutId = resolveDashboardLayoutId(access.roleCode);
  if (access.isManagement) layoutId = 'management';
  else if (access.isOfficeStaff) layoutId = 'office_staff';
  else if (access.isFieldStaff) layoutId = 'field_staff';
  else if (layoutId === 'expert_portal' || layoutId === 'insurance_portal') {
    /* portal — registry id korunur */
  } else layoutId = 'default';

  return {
    layoutId,
    usesDashboardShell: true,
    showFinanceBand: access.showFinanceWidgets && layoutId === 'management',
    showAcilInFlow: access.showAcilYardim,
  };
}

/** Ortak chrome kanıtı — tüm layout’lar (personel + portal) aynı shell bileşenini kullanır. */
export const SHARED_DASHBOARD_SHELL = {
  shell: 'DashboardShell',
  header: 'DashboardHeader',
  brand: 'BrandLogo',
  theme: 'PanelThemeToggle',
  help: 'PanelHelpDrawer',
} as const;
