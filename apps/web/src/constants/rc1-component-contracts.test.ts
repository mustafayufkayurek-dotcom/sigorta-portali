/** BrandLogo / LoginBrandLogo — resmi path ve varyantları */

import { CORPORATE_LOGO_ORIGINAL_PNG } from './brand';
import {
  PANEL_SIDEBAR_WIDTH_COLLAPSED,
  PANEL_SIDEBAR_WIDTH_EXPANDED,
} from '../config/panel-layout-spacing';
import { formatActivityAction } from '../features/dashboard/utils/format-activity-action';
import {
  HELP_DRAWER_DEFAULT_WIDTH,
  HELP_DRAWER_MAX_WIDTH,
  HELP_DRAWER_MIN_WIDTH,
} from '../contexts/PanelHelpDrawerContext';
import { PANEL_THEME_OPTIONS, applyPanelThemeToDocument } from '../utils/panel-time-theme';
import { readFileSync } from 'fs';
import { join } from 'path';

function assert(cond: boolean, msg: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

const OFFICIAL = '/meridyen-logo-original.png';

// --- BrandLogo path ---
assert(CORPORATE_LOGO_ORIGINAL_PNG === OFFICIAL, 'BrandLogo resmi path');

// --- LoginBrandLogo source uses BrandLogo login variant ---
const loginSrc = readFileSync(
  join(__dirname, '../components/brand/LoginBrandLogo.tsx'),
  'utf8',
);
assert(loginSrc.includes("variant=\"login\""), 'LoginBrandLogo login variant');
assert(loginSrc.includes('BrandLogo'), 'LoginBrandLogo uses BrandLogo');

const brandLogoSrc = readFileSync(
  join(__dirname, '../components/brand/BrandLogo.tsx'),
  'utf8',
);
assert(brandLogoSrc.includes('CORPORATE_LOGO_ORIGINAL_PNG'), 'BrandLogo uses constant');
assert(!brandLogoSrc.includes('meridyen-assistance-logo'), 'BrandLogo no JPEG');

// --- Sidebar expanded/collapsed HARD classes ---
assert(PANEL_SIDEBAR_WIDTH_EXPANDED.includes('220px'), 'sidebar expanded 220');
assert(PANEL_SIDEBAR_WIDTH_COLLAPSED.includes('72px'), 'sidebar collapsed 72');

const layoutSrc = readFileSync(join(__dirname, '../app/panel/layout.tsx'), 'utf8');
assert(layoutSrc.includes("panel-sidebar-collapsed"), 'sidebar localStorage key');
assert(layoutSrc.includes('PANEL_SIDEBAR_WIDTH_EXPANDED'), 'layout uses expanded const');
assert(layoutSrc.includes('PANEL_SIDEBAR_WIDTH_COLLAPSED'), 'layout uses collapsed const');

// Persistence: setItem on toggle
assert(
  layoutSrc.includes("localStorage.setItem('panel-sidebar-collapsed'"),
  'sidebar persistence setItem',
);
assert(
  layoutSrc.includes("localStorage.getItem('panel-sidebar-collapsed')"),
  'sidebar persistence getItem',
);

// --- Günün Akışı render / grid ---
const flowSrc = readFileSync(
  join(__dirname, '../features/dashboard/components/admin/admin-daily-flow-section.tsx'),
  'utf8',
);
assert(flowSrc.includes('Günün Akışı'), 'Günün Akışı title');
assert(flowSrc.includes('Gider Dağıtımı') || flowSrc.includes('Gider'), 'Gider kartı');
assert(
  flowSrc.includes('xl:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.25fr)]'),
  'Gider ≤1.25fr grid',
);
assert(flowSrc.includes('grid-cols-1'), 'mobil tek kolon');
assert(flowSrc.includes('sm:grid-cols-2'), 'tablet 2 kolon');
assert(flowSrc.includes('md:grid-cols-3') || flowSrc.includes('sm:grid-cols-2'), 'tablet 2-3 kolon');

// --- status_change asla ham görünmez ---
assert(formatActivityAction('status_change') === 'Durum Değişti', 'status_change mapped');
assert(formatActivityAction('file_updated') === 'İşlem güncellendi', 'unknown snake fallback');
assert(formatActivityAction('UNKNOWN_CODE') === 'İşlem güncellendi', 'screaming snake fallback');
assert(formatActivityAction(null) === 'İşlem güncellendi', 'null fallback');
assert(!formatActivityAction('status_change').includes('_'), 'no underscore in UI');

// Activity widgets use formatter
const activitySrc = readFileSync(
  join(__dirname, '../features/dashboard/components/activity/activity-feed-widget.tsx'),
  'utf8',
);
assert(activitySrc.includes('formatActivityAction'), 'activity feed uses formatter');
assert(activitySrc.includes('claimNavHref'), 'activity feed uses claimNavHref');
assert(
  activitySrc.includes('DashboardRowLink') || activitySrc.includes('onNavigate'),
  'activity feed navigates via Link or onNavigate',
);

// --- C3 Operasyon / Kritik Uyarı satır navigasyonu ---
const c3Src = readFileSync(
  join(__dirname, '../features/dashboard/components/admin/admin-operations-critical-row.tsx'),
  'utf8',
);
assert(c3Src.includes('OPERATIONS_CENTER_HREF') || c3Src.includes('/panel/operasyon'), 'C3 Operasyon Merkezi');
assert(c3Src.includes('CLAIM_LIST_SLA_HREF') || c3Src.includes('status=sla_exceeded'), 'C3 Tümünü Gör SLA');
assert(c3Src.includes('DashboardRowLink'), 'C3 satır Link bileşeni');
assert(c3Src.includes('claimNavHref'), 'C3 claimNavHref');
assert(c3Src.includes('staffLoadHref') || c3Src.includes('personel-yonetimi'), 'C3 Son Atamalar nav');
assert(c3Src.includes('items-start'), 'C3 equal-height stretch kaldırıldı');
assert(!c3Src.includes('items-stretch'), 'C3 items-stretch yok');
assert(c3Src.includes('line-clamp-2'), 'C3 kontrollü line-clamp');
assert(c3Src.includes('aria-label'), 'C3 aria-label');
assert(!c3Src.includes('min-h-[280') && !c3Src.includes('min-h-[320'), 'C3 kritik panel min-h zorlaması yok');

const pendingSrc = readFileSync(
  join(__dirname, '../features/dashboard/components/queue/pending-actions-widget.tsx'),
  'utf8',
);
assert(pendingSrc.includes('formatActivityAction'), 'pending actions TR map');
assert(pendingSrc.includes('claimNavHref'), 'pending actions claimNavHref');
assert(pendingSrc.includes('DashboardRowLink'), 'pending actions DashboardRowLink');

const criticalWidgetSrc = readFileSync(
  join(__dirname, '../features/dashboard/components/alerts/critical-alerts-widget.tsx'),
  'utf8',
);
assert(!criticalWidgetSrc.includes('min-h-[172px]'), 'critical alerts widget no forced min-h');
assert(criticalWidgetSrc.includes('items-start'), 'critical alerts items-start');
const rowLinkSrc = readFileSync(
  join(__dirname, '../features/dashboard/components/dashboard-row-link.tsx'),
  'utf8',
);
assert(rowLinkSrc.includes('onKeyDown'), 'DashboardRowLink Space destekler');
assert(rowLinkSrc.includes('cursor-pointer'), 'DashboardRowLink cursor');
assert(rowLinkSrc.includes('focus-visible:ring'), 'DashboardRowLink focus ring');

const officeSrc = readFileSync(
  join(__dirname, '../features/dashboard/components/admin/office-bottom-row.tsx'),
  'utf8',
);
assert(officeSrc.includes('DashboardRowLink'), 'office satır Link');
assert(officeSrc.includes('claimNavHref'), 'office claimNavHref');

const fieldSrc = readFileSync(
  join(__dirname, '../features/dashboard/components/admin/field-bottom-row.tsx'),
  'utf8',
);
assert(fieldSrc.includes('DashboardRowLink'), 'field satır Link');
assert(fieldSrc.includes('claimNavHref'), 'field claimNavHref');

const claimNavSrc = readFileSync(
  join(__dirname, '../features/dashboard/utils/claim-nav-href.ts'),
  'utf8',
);
assert(claimNavSrc.includes('encodeURIComponent'), 'claim nav encodes params');

// --- Rol layout registry ---
const roleLayoutSrc = readFileSync(
  join(__dirname, '../features/dashboard/registry/role-dashboard-layout.ts'),
  'utf8',
);
assert(roleLayoutSrc.includes("admin: 'management'"), 'admin management layout');
assert(roleLayoutSrc.includes("office_staff: 'office_staff'"), 'office layout');
assert(roleLayoutSrc.includes("field_staff: 'field_staff'"), 'field layout');
assert(roleLayoutSrc.includes("expert: 'expert_portal'"), 'expert portal layout');
assert(roleLayoutSrc.includes("insurance_company_user: 'insurance_portal'"), 'insurance portal layout');
assert(roleLayoutSrc.includes("SHARED_DASHBOARD_SHELL"), 'shared shell contract');
const panelPageSrc = readFileSync(join(__dirname, '../app/panel/page.tsx'), 'utf8');
assert(panelPageSrc.includes('resolveDashboardLayout'), 'panel uses layout registry');
assert((panelPageSrc.match(/DashboardShell/g) || []).length >= 4, 'all role branches use DashboardShell');

// Portal dashboards — aynı shell (PortalCompactHeader dashboard home yasak)
const expertPortalSrc = readFileSync(
  join(__dirname, '../app/panel/eksper-portal/page.tsx'),
  'utf8',
);
assert(expertPortalSrc.includes('DashboardShell'), 'eksper uses DashboardShell');
assert(expertPortalSrc.includes('DashboardHeader'), 'eksper uses DashboardHeader');
assert(!expertPortalSrc.includes('PortalCompactHeader'), 'eksper no PortalCompactHeader');
const insurancePortalSrc = readFileSync(
  join(__dirname, '../app/panel/sigorta-portal/page.tsx'),
  'utf8',
);
assert(insurancePortalSrc.includes('DashboardShell'), 'sigorta uses DashboardShell');
assert(insurancePortalSrc.includes('DashboardHeader'), 'sigorta uses DashboardHeader');
assert(!insurancePortalSrc.includes('PortalCompactHeader'), 'sigorta no PortalCompactHeader');
// BrandLogo topbar — portal dahil (RC1 chrome)
assert(layoutSrc.includes('BrandLogo'), 'layout BrandLogo');
assert(layoutSrc.includes("variant=\"topbar\""), 'BrandLogo topbar variant');
assert(layoutSrc.includes("isExpert ? '/panel/eksper-portal'"), 'portal BrandLogo home link');
assert(layoutSrc.includes('max-w-screen-2xl px-3 sm:px-4'), 'portal main padding matches admin');
assert(!layoutSrc.includes('max-w-none px-2 sm:px-3'), 'no portal-only max-w-none padding');

// --- Yardım tek drawer ---
assert(HELP_DRAWER_MIN_WIDTH === 320, 'help min width');
assert(HELP_DRAWER_MAX_WIDTH === 560, 'help max width');
assert(HELP_DRAWER_DEFAULT_WIDTH === 380, 'help default width');
assert(layoutSrc.includes('PanelHelpDrawer'), 'layout mounts PanelHelpDrawer');
assert(!layoutSrc.includes('admin-guide-panel'), 'no dead guide panel');
const helpDrawerSrc = readFileSync(
  join(__dirname, '../components/panel/PanelHelpDrawer.tsx'),
  'utf8',
);
assert(helpDrawerSrc.includes('usePanelHelpDrawer'), 'single help context');

// --- Tema: 5 seçenek, layout sabit shell sınıfları ---
assert(PANEL_THEME_OPTIONS.length === 5, '5 tema');
const themeIds = PANEL_THEME_OPTIONS.map((o) => o.id).sort().join(',');
assert(
  themeIds === 'corporate-blue,corporate-dark,dark,high-contrast,light',
  `tema ids: ${themeIds}`,
);

// applyPanelThemeToDocument is callable (jsdom-less: only if document exists)
if (typeof document !== 'undefined') {
  applyPanelThemeToDocument({ mode: 'dark' });
  assert(document.documentElement.classList.contains('dark'), 'dark class applied');
  applyPanelThemeToDocument({ mode: 'light' });
}

const themeToggleSrc = readFileSync(
  join(__dirname, '../components/panel/PanelThemeToggle.tsx'),
  'utf8',
);
assert(themeToggleSrc.includes('PANEL_THEME_OPTIONS'), 'theme toggle uses options');
assert(themeToggleSrc.includes('applyPanelThemeToDocument'), 'theme applies without layout rewrite');

console.log('rc1-component-contracts.test.ts PASS');
