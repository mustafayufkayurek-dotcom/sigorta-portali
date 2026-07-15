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
