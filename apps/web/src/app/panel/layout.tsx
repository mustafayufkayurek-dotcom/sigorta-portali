'use client';

import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState, useRef, useCallback } from 'react';
import { ToastProvider } from '@/contexts/ToastContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import AgreementConsentModal from '@/components/AgreementConsentModal';
import GlobalSearch from '@/components/GlobalSearch';
import { SESSION_KEEPALIVE_MS, API } from '@/utils/api';
import { clearAuth, ensureValidSession, getAccessToken, getRefreshToken, hasValidSessionScope, persistTokens, isRememberMePreferred, isRememberMeInactive, isRememberMeExpired, logoutAndRedirect } from '@/utils/auth-session';
import { installAxiosAuthInterceptors } from '@/utils/setup-axios-auth';
import SessionTimeoutBar from '@/components/SessionTimeoutBar';
import { NavigationGuardProvider } from '@/contexts/NavigationGuardContext';
import { TopProgressBar } from '@/components/ui/TopProgressBar';
import { GlobalActivityStrip } from '@/components/ui/GlobalActivityStrip';
import { LoadingScreen } from '@/components/ui/LoadingIndicator';
import { SidebarNavTooltip } from '@/components/ui/SidebarNavTooltip';
import { isFieldStaffRole, isFinanceRole, isOfficeStaffRole, roleAllowedForNav } from '@/hooks/usePanelRole';
import {
  canAccessAcilYardim,
  getSafePanelHomePath,
  hasPanelRouteAccess,
  userOperationArea,
} from '@/utils/panel-access';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { apiClient } from '@/lib/api-client';
import axios from 'axios';
import { getDefaultScreensForRole } from '@/utils/screen-permissions-defaults';
import { PanelSidebarGuideFooter } from '@/components/panel/PanelSidebarGuideFooter';
import { PANEL_BACKEND_VERSION, PANEL_WEB_VERSION } from '@/config/panel-build-info';
import { GUIDE_CONTENT_VERSION } from '@/config/panel-user-guide';
import { PanelHelpDrawer } from '@/components/panel/PanelHelpDrawer';
import { PanelThemeToggle } from '@/components/panel/PanelThemeToggle';
import { PanelSystemHealth } from '@/components/panel/PanelSystemHealth';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { PanelUserProvider } from '@/contexts/PanelUserContext';
import {
  PanelHelpDrawerProvider,
  usePanelHelpDrawerOptional,
} from '@/contexts/PanelHelpDrawerContext';
import { applyPanelThemeToDocument, type StoredThemeConfig } from '@/utils/panel-time-theme';
import PortalBottomNav from '@/components/portal/PortalBottomNav';
import { PortalWhatsAppLiveSupport } from '@/components/panel/portal-whatsapp-live-support';
import {
  PANEL_MAIN_TOP,
  PANEL_NAVBAR_HEIGHT,
  PANEL_SIDEBAR_WIDTH_COLLAPSED,
  PANEL_SIDEBAR_WIDTH_EXPANDED,
} from '@/config/panel-layout-spacing';
import { resolvePanelUserGuide } from '@/config/panel-user-guide';
import {
  getExpertPortalNav,
  getInsurancePortalNav,
  getAssistancePortalNav,
  type ExpertPortalNavCounts,
  type InsurancePortalNavCounts,
} from '@/config/portal-nav';
import { countExpertQueues, normalizeExpertQueueParam } from '@/utils/expert-portal-queues';
import { ACIL_OPERATION_ICON, HASAR_OPERATION_ICON } from '@/constants/operation-icons';
import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  Building2,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  FileText,
  GitBranch,
  HelpCircle,
  MapPin,
  MessageSquareText,
  MonitorCheck,
  PackageCheck,
  Receipt,
  Settings,
  ShieldCheck,
  Users,
  TestTube2,
  UserCog,
  Zap,
} from 'lucide-react';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1').replace(/\/$/, '').replace(/\/api\/v1$/, '/api/v1');

// ── Rol Bazlı Erişim (nav görünürlüğü) ────────────────────────────────────────
type RoleCode = string;

interface NavItemAccess {
  path: string;
  roles: RoleCode[];
}

const NAV_ITEM_ACCESS: NavItemAccess[] = [
  { path: '/panel/hasar-dosyalari', roles: ['admin', 'ADMIN', 'office_staff', 'OFFICE_STAFF', 'field_staff', 'FIELD_STAFF', 'FINANS', 'MANAGER'] },
  { path: '/panel/revizyon-talepleri', roles: ['admin', 'ADMIN', 'office_staff', 'OFFICE_STAFF', 'FINANS', 'MANAGER'] },
  { path: '/panel/sahiplik', roles: ['admin', 'ADMIN', 'MANAGER'] },
  { path: '/panel/personel-yonetimi', roles: ['admin', 'ADMIN', 'MANAGER'] },
  { path: '/panel/personel-ozluk', roles: ['admin', 'ADMIN', 'MANAGER', 'office_staff', 'OFFICE_STAFF', 'field_staff', 'FIELD_STAFF', 'FINANS', 'finance', 'accountant', 'ACCOUNTANT'] },
  { path: '/panel/musteriler', roles: ['admin', 'ADMIN', 'office_staff', 'OFFICE_STAFF', 'FINANS', 'MANAGER'] },
  { path: '/panel/tedarikciler', roles: ['admin', 'ADMIN', 'office_staff', 'OFFICE_STAFF', 'FINANS', 'MANAGER'] },
  { path: '/panel/crm', roles: ['admin', 'ADMIN', 'office_staff', 'OFFICE_STAFF', 'FINANS', 'MANAGER'] },
  { path: '/panel/eksper-portal', roles: ['admin', 'ADMIN', 'office_staff', 'OFFICE_STAFF'] },
  { path: '/panel/sigorta-portal', roles: ['admin', 'ADMIN', 'office_staff', 'OFFICE_STAFF'] },
  { path: '/panel/finans', roles: ['admin', 'ADMIN', 'accountant', 'ACCOUNTANT', 'FINANS', 'MANAGER'] },
  { path: '/panel/raporlar', roles: ['admin', 'ADMIN', 'accountant', 'ACCOUNTANT', 'FINANS', 'MANAGER'] },
  { path: '/panel/anketler', roles: ['admin', 'ADMIN', 'office_staff', 'OFFICE_STAFF', 'FINANS', 'MANAGER'] },
  { path: '/panel/ayarlar/test-notlari-gorev-takip', roles: ['admin', 'ADMIN', 'office_staff', 'OFFICE_STAFF', 'FINANS', 'finance', 'accountant', 'ACCOUNTANT', 'MANAGER'] },
  { path: '/panel/ayarlar/is-gruplari', roles: ['admin', 'ADMIN', 'office_staff', 'OFFICE_STAFF', 'finance', 'FINANS', 'accountant', 'ACCOUNTANT', 'MANAGER'] },
  { path: '/panel/ayarlar', roles: ['admin', 'ADMIN'] },
  { path: '/panel/kullanicilar', roles: ['admin', 'ADMIN'] },
  { path: '/panel/guvenlik', roles: ['admin', 'ADMIN'] },
  { path: '/panel/harita', roles: ['admin', 'ADMIN', 'office_staff', 'OFFICE_STAFF', 'MANAGER'] },
  { path: '/panel/acil-yardim', roles: ['admin', 'ADMIN', 'office_staff', 'OFFICE_STAFF', 'MANAGER'] },
  { path: '/panel/operasyon/gelen-kutusu', roles: ['admin', 'ADMIN', 'office_staff', 'OFFICE_STAFF', 'FINANS', 'finance', 'accountant', 'ACCOUNTANT', 'MANAGER'] },
  { path: '/panel/operasyon', roles: ['admin', 'ADMIN', 'office_staff', 'OFFICE_STAFF', 'FINANS', 'MANAGER'] },
  { path: '/panel/carilerim', roles: ['field_staff', 'FIELD_STAFF', 'admin', 'ADMIN', 'FINANS', 'OFFICE_STAFF', 'office_staff', 'MANAGER'] },
];

function canSeeNavItem(path: string, roleCode: string): boolean {
  const rule = NAV_ITEM_ACCESS.find((r) => path.startsWith(r.path));
  if (!rule) return true;
  if (rule.roles.length === 0) return true;
  return roleAllowedForNav(roleCode, rule.roles);
}

// Ekran kodu → path eşlemesi (DB izin sistemi için)
const SCREEN_TO_PATH: Record<string, string> = {
  dashboard:         '/panel',
  hasar_dosyalari:   '/panel/hasar-dosyalari',
  acil_yardim:       '/panel/acil-yardim',
  finans:            '/panel/finans',
  operasyon:         '/panel/operasyon',
  sahiplik:          '/panel/sahiplik',
  crm:               '/panel/crm',
  musteriler:        '/panel/musteriler',
  tedarikciler:      '/panel/tedarikciler',
  raporlar:          '/panel/raporlar',
  ayarlar:           '/panel/ayarlar',
  kullanicilar:      '/panel/kullanicilar',
  guvenlik:          '/panel/guvenlik',
  harita:            '/panel/harita',
  personel_yonetimi: '/panel/personel-yonetimi',
  personel_ozluk: '/panel/personel-ozluk',
  test_notes_admin: '/panel/ayarlar/test-notlari-gorev-takip',
};

const LOCKED_MAIN_NAV_PATHS = new Set([
  '/panel',
  '/panel/operasyon',
  '/panel/personel-yonetimi',
  '/panel/sahiplik',
  '/panel/musteriler',
  '/panel/tedarikciler',
  '/panel/crm',
  '/panel/finans',
  '/panel/harita',
  '/panel/ayarlar',
  '/panel/ayarlar/departmanlar',
]);

function isLockedMainNavPath(navPath: string) {
  return Array.from(LOCKED_MAIN_NAV_PATHS).some((path) => navPath === path || navPath.startsWith(path + '/'));
}

function canSeeNavItemDynamic(navPath: string, allowedScreens: string[], roleCode: string): boolean {
  if (isLockedMainNavPath(navPath)) {
    return canSeeNavItem(navPath, roleCode);
  }

  const match = Object.entries(SCREEN_TO_PATH)
    .sort(([, a], [, b]) => b.length - a.length)
    .find(([, p]) => navPath === p || navPath.startsWith(p + '/'));
  if (!match) return true;
  const screen = match[0];
  if (allowedScreens.includes(screen)) return true;
  // Eski eksperler ekran izni → müşteriler menüsü
  if (screen === 'musteriler' && allowedScreens.includes('eksperler')) return true;
  return false;
}

const CONTEXT_BACK_LINKS: Record<string, { href: string; label: string }> = {
  '/panel/admin/audit-logs': { href: '/panel/guvenlik', label: 'Güvenlik sayfasına dön' },
  '/panel/guvenlik/erisim-loglari': { href: '/panel/guvenlik', label: 'Güvenlik sayfasına dön' },
  '/panel/masraflar': { href: '/panel/finans', label: 'Finans sayfasına dön' },
  '/panel/ozel-dosyalar': { href: '/panel', label: 'Dashboard sayfasına dön' },
  '/panel/sigorta-sirketleri': { href: '/panel', label: 'Dashboard sayfasına dön' },
};

function getContextBackLink(pathname: string) {
  return CONTEXT_BACK_LINKS[pathname] ?? null;
}

interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  status: string;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  createdAt: string;
  readAt?: string | null;
}

interface NavigationLink {
  title: string;
  href: string;
  badge?: string;
  alertCount?: number;
  children?: NavigationLink[];
  icon?: LucideIcon;
  /** Yalnızca tam path eşleşmesinde aktif (ör. Finans Özeti ana sayfa) */
  exactMatch?: boolean;
  /** Öncesinde +8px grup boşluğu (Enterprise Sol Menü) */
  groupStart?: boolean;
}

interface PanelSidebarProps {
  pathname: string;
  roleCode: string;
  isPortalUser: boolean;
  isExpert: boolean;
  isInsuranceCompanyUser: boolean;
  isAssistanceCompanyUser: boolean;
  isFinance: boolean;
  isFieldStaff: boolean;
  pendingRevisionCount: number;
  allowedScreens: string[] | null;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  hidden?: boolean;
}

function getPanelMainLinks({
  isExpert,
  isInsuranceCompanyUser,
  isAssistanceCompanyUser,
  isOfficeStaff,
  isFinance,
  isFieldStaff,
  pendingRevisionCount,
  expertNavCounts,
  insuranceNavCounts,
  assistanceNavCounts,
}: {
  isExpert: boolean;
  isInsuranceCompanyUser: boolean;
  isAssistanceCompanyUser: boolean;
  isOfficeStaff: boolean;
  isFinance: boolean;
  isFieldStaff: boolean;
  pendingRevisionCount: number;
  expertNavCounts?: ExpertPortalNavCounts;
  insuranceNavCounts?: InsurancePortalNavCounts;
  assistanceNavCounts?: InsurancePortalNavCounts;
}): NavigationLink[] {
  const opsBadge = pendingRevisionCount > 0 ? pendingRevisionCount : undefined;
  return isExpert
    ? getExpertPortalNav(expertNavCounts)
    : isInsuranceCompanyUser
      ? getInsurancePortalNav(insuranceNavCounts)
      : isAssistanceCompanyUser
        ? getAssistancePortalNav(assistanceNavCounts)
      : isOfficeStaff
        ? [
            { title: 'Dosya Merkezi', href: '/panel', icon: MonitorCheck },
            {
              title: 'Operasyon',
              href: '/panel/operasyon',
              alertCount: opsBadge,
              icon: ClipboardList,
              children: [
                { title: 'Hasar Dosyaları', href: '/panel/hasar-dosyalari' },
                { title: 'Acil Yardım Dosyaları', href: '/panel/operasyon?filter=acil' },
              ],
            },
            { title: 'Müşteriler', href: '/panel/musteriler', icon: Users },
            { title: 'Tedarikçiler', href: '/panel/tedarikciler', icon: PackageCheck },
            { title: 'CRM', href: '/panel/crm', icon: GitBranch },
            { title: 'Harita', href: '/panel/harita', icon: MapPin },
            {
              title: 'Anketler',
              href: '/panel/anketler/sonuclar',
              icon: MessageSquareText,
              children: [{ title: 'Anket Sonuçları', href: '/panel/anketler/sonuclar' }],
            },
            { title: 'Personel Özlük', href: '/panel/personel-ozluk', icon: ClipboardList },
            { title: 'Test Notları', href: '/panel/ayarlar/test-notlari-gorev-takip', icon: TestTube2 },
          ]
      : isFieldStaff
        ? [
            { title: 'Saha Merkezi', href: '/panel', icon: MonitorCheck },
            { title: 'Hasar Dosyaları', href: '/panel/hasar-dosyalari', icon: ClipboardList },
            { title: 'Personel Özlük', href: '/panel/personel-ozluk', icon: ClipboardList },
            { title: 'Carilerim', href: '/panel/carilerim', icon: Building2 },
          ]
      : isFinance
        ? [
            { title: 'Finans Merkezi', href: '/panel/finans', icon: MonitorCheck, exactMatch: true },
            { title: 'Fatura Talepleri', href: '/panel/finans/faturalar?tab=talepler', icon: FileText },
            { title: 'Ödeme Kuyruğu', href: '/panel/finans/tahsilatlar?queue=payable', icon: Receipt },
            {
              title: 'Operasyon',
              href: '/panel/operasyon',
              alertCount: opsBadge,
              icon: ClipboardList,
              children: [
                { title: 'Hasar Dosyaları', href: '/panel/hasar-dosyalari' },
                { title: 'Acil Yardım Dosyaları', href: '/panel/operasyon?filter=acil' },
              ],
            },
            { title: 'Müşteriler', href: '/panel/musteriler', icon: Users },
            { title: 'Tedarikçiler', href: '/panel/tedarikciler', icon: PackageCheck },
            { title: 'Carilerim', href: '/panel/carilerim', icon: Building2 },
            { title: 'Raporlar', href: '/panel/raporlar', icon: ClipboardList },
            {
              title: 'Anketler',
              href: '/panel/anketler/sonuclar',
              icon: MessageSquareText,
              children: [{ title: 'Anket Sonuçları', href: '/panel/anketler/sonuclar' }],
            },
            { title: 'Personel Özlük', href: '/panel/personel-ozluk', icon: ClipboardList },
            { title: 'Test Notları', href: '/panel/ayarlar/test-notlari-gorev-takip', icon: TestTube2 },
          ]
      : [
          { title: 'Dashboard', href: '/panel', icon: MonitorCheck },
          {
            title: 'Operasyon',
            href: '/panel/operasyon',
            alertCount: opsBadge,
            icon: ClipboardList,
            groupStart: true,
            children: [
              { title: 'Hasar Dosyaları', href: '/panel/hasar-dosyalari' },
              { title: 'Acil Yardım Dosyaları', href: '/panel/operasyon?filter=acil' },
            ],
          },
          { title: 'Performans Yönetimi', href: '/panel/personel-yonetimi', icon: UserCog, groupStart: true },
          { title: 'Personel Özlük', href: '/panel/personel-ozluk', icon: ClipboardList },
          { title: 'Sahiplik', href: '/panel/sahiplik', icon: ShieldCheck },
          { title: 'Müşteriler', href: '/panel/musteriler', icon: Users, groupStart: true },
          { title: 'Tedarikçiler', href: '/panel/tedarikciler', icon: PackageCheck },
          { title: 'CRM', href: '/panel/crm', icon: GitBranch },
          { title: 'Finans', href: '/panel/finans', icon: Receipt, groupStart: true },
          { title: 'Harita', href: '/panel/harita', icon: MapPin },
          {
            title: 'Anketler',
            href: '/panel/anketler/sonuclar',
            icon: MessageSquareText,
            groupStart: true,
            children: [{ title: 'Anket Sonuçları', href: '/panel/anketler/sonuclar' }],
          },
          { title: 'Test Notları', href: '/panel/ayarlar/test-notlari-gorev-takip', icon: TestTube2, groupStart: true },
          { title: 'Ayarlar', href: '/panel/ayarlar', icon: Settings },
        ];
}

// ── Üst Navbar ────────────────────────────────────────────────────────────────
interface NavbarProps {
  user: any;
  pathname: string;
  roleCode: string;
  isPortalUser: boolean;
  isExpert: boolean;
  isInsuranceCompanyUser: boolean;
  isAssistanceCompanyUser: boolean;
  pendingRevisionCount: number;
  onLogout: () => void;
  unreadCount: number;
  notifOpen: boolean;
  onNotifOpen: () => void;
  onNotifClose: () => void;
  notifications: AppNotification[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onNotifClick: (n: AppNotification) => void;
  relativeTime: (d: string) => string;
  notifTypeColor: (t: string) => string;
  notifTypeBorder: (t: string) => string;
  notifTypeIcon: (t: string) => string;
  allowedScreens: string[] | null;
  isFinance: boolean;
  isFieldStaff: boolean;
  showAcilYardim: boolean;
  userGuide?: ReturnType<typeof resolvePanelUserGuide>;
  onToggleSidebar?: () => void;
  sidebarCollapsed?: boolean;
}

function Navbar({
  user, pathname, roleCode, isPortalUser, isExpert, isInsuranceCompanyUser, isAssistanceCompanyUser,
  pendingRevisionCount, onLogout,
  unreadCount, notifOpen, onNotifOpen, onNotifClose, notifications, onMarkAllRead,
  onNotifClick, relativeTime, notifTypeColor, notifTypeBorder, notifTypeIcon,
  allowedScreens, companyLogo: _companyLogo, companyName: _companyName,
  isFinance, isFieldStaff, showAcilYardim, userGuide,
  onToggleSidebar, sidebarCollapsed = false,
}: NavbarProps & { companyLogo: string | null; companyName: string }) {
  // Yetki kontrolü: DB izinleri varsa öncelikli, yoksa role-default
  const canSee = (path: string) =>
    allowedScreens !== null
      ? canSeeNavItemDynamic(path, allowedScreens, roleCode)
      : canSeeNavItem(path, roleCode);

  /** Üst bant satır 1: sigorta şirketi / kurum (bandı büyütmeden) */
  const profileContextLabel = (() => {
    if (isInsuranceCompanyUser) {
      const scopes = (
        (user?.assistantCustomerScopes as Array<string | { name?: string }> | undefined)
        ?? (user?.insuranceCompanyScopes as Array<string | { name?: string }> | undefined)
      );
      const fromScope = scopes
        ?.map((s) => (typeof s === 'string' ? undefined : s?.name?.trim()))
        .find((n): n is string => Boolean(n));
      if (fromScope) return fromScope;
    }
    if (isExpert) return 'Eksper';
    const org = typeof _companyName === 'string' ? _companyName.trim() : '';
    return org || '';
  })();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  /** Mobil alt menü accordion — masaüstü sidebar ile aynı davranış */
  const [mobileExpandedGroups, setMobileExpandedGroups] = useState<Record<string, boolean>>({});
  const [profileDropOpen, setProfileDropOpen] = useState(false);
  const [quickActionOpen, setQuickActionOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [searchShortcut, setSearchShortcut] = useState('Ctrl+K');
  const helpDrawer = usePanelHelpDrawerOptional();
  const notifRef = useRef<HTMLDivElement>(null);
  const profileDropRef = useRef<HTMLDivElement>(null);
  const quickActionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsHydrated(true);
    const isMac =
      typeof navigator !== 'undefined' &&
      /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent || '');
    setSearchShortcut(isMac ? '⌘K' : 'Ctrl+K');
  }, []);

  // Ctrl+K / Cmd+K → arama aç
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Dışarı tıklamada dropdown'ları kapat
  useEffect(() => {
    const handler = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (profileDropRef.current && !profileDropRef.current.contains(target)) setProfileDropOpen(false);
      if (quickActionRef.current && !quickActionRef.current.contains(target)) setQuickActionOpen(false);
      if (notifRef.current && !notifRef.current.contains(target)) onNotifClose();
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [onNotifClose]);

  const mainLinks = getPanelMainLinks({
    isExpert,
    isInsuranceCompanyUser,
    isAssistanceCompanyUser,
    isOfficeStaff: isOfficeStaffRole(roleCode),
    isFinance,
    isFieldStaff,
    pendingRevisionCount,
  });
  const visibleMainLinks = isPortalUser ? mainLinks : mainLinks.filter((link) => canSee(link.href));

  const canCreateHasar = !isPortalUser && canSee('/panel/hasar-dosyalari');
  const canCreateAcil = !isPortalUser && showAcilYardim;
  const canOpenMonday = !isPortalUser && canSee('/panel/pazartesi-toplantisi');
  const showQuickActions = canCreateHasar || canCreateAcil || canOpenMonday;

  return (
    // MOBILE_SHELL_LOCK (v423+):
    // 1) header'a overflow-x-hidden KOYMA — profil dropdown kesilir
    // 2) mobil menüyü h-14 flex satırının İÇİNE koyma — yatay taşma / yüzen link
    // 3) mobil menü paneli fixed top-14 olmalı — sticky header şişmesin
    // 4) alt başlıklar accordion (varsayılan kapalı; aktif rota açıksın)
    <header className="sticky top-0 z-50 border-b border-[#E5E7EB] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.04)] dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100">
      <div className={`flex ${PANEL_NAVBAR_HEIGHT} w-full min-w-0 shrink-0 items-center`}>
        {/* Marka rayı — sidebar genişliği ile aynı; arama içerik sol kenarına hizalanır */}
        <div
          className={`hidden h-full shrink-0 items-center border-r border-transparent md:flex ${
            sidebarCollapsed
              ? 'w-[72px] min-w-[72px] max-w-[72px] justify-center px-1'
              : 'w-[260px] min-w-[260px] max-w-[260px] gap-3 px-4'
          }`}
        >
          {onToggleSidebar ? (
            <button
              type="button"
              onClick={onToggleSidebar}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-slate-800"
              title={sidebarCollapsed ? 'Menüyü Genişlet' : 'Menüyü Daralt'}
              aria-label={sidebarCollapsed ? 'Menüyü Genişlet' : 'Menüyü Daralt'}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          ) : null}
          {!sidebarCollapsed ? (
            <Link
              href={isExpert ? '/panel/eksper-portal' : isInsuranceCompanyUser ? '/panel/sigorta-portal' : isAssistanceCompanyUser ? '/panel/asistans-portal' : '/panel'}
              className="inline-flex min-w-0 items-center"
              title="Panel Ana Sayfa"
              aria-label="Meridyen Panel"
            >
              <BrandLogo alt="Meridyen Assistance" variant="topbar" />
            </Link>
          ) : null}
        </div>

        {/* İçerik rayı — main ile aynı yatay padding (px-3 sm:px-4) */}
        <div className="flex min-w-0 flex-1 items-center gap-2 px-3 sm:px-4">
          {/* Mobil logo */}
          <Link
            href={isExpert ? '/panel/eksper-portal' : isInsuranceCompanyUser ? '/panel/sigorta-portal' : isAssistanceCompanyUser ? '/panel/asistans-portal' : '/panel'}
            className="inline-flex shrink-0 items-center md:hidden"
            title="Panel Ana Sayfa"
            aria-label="Meridyen Panel"
          >
            <BrandLogo alt="Meridyen Assistance" variant="topbar" />
          </Link>

          {/* Arama — Dosyalarım çerçevesi sol kenarı ile hizalı */}
          <div className="hidden min-w-0 max-w-md flex-1 md:block lg:max-w-lg">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex h-9 w-full min-w-0 items-center gap-2 rounded-lg border border-[#E5E7EB] bg-slate-50/80 px-3 text-sm text-slate-400 transition-all hover:border-slate-300 hover:bg-white hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
              title={`Global Arama (${searchShortcut})`}
              aria-keyshortcuts="Control+K Meta+K"
            >
              <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="min-w-0 flex-1 truncate text-left text-xs text-slate-400">
                Dosya, Müşteri, Personel, Telefon, Plaka, Tedarikçi…
              </span>
              <kbd className="hidden shrink-0 items-center gap-0.5 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] font-medium text-slate-500 lg:inline-flex dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400">
                {searchShortcut}
              </kbd>
            </button>
          </div>

          {/* Sağ aksiyonlar + profil */}
          <div className="ml-auto flex shrink-0 items-center justify-end gap-1.5 sm:gap-2">

            {/* Mobil arama ikonu */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="md:hidden flex items-center justify-center w-9 h-9 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors dark:hover:bg-slate-800"
              title="Ara"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>

            {/* Global Search Modal */}
            <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />

            {/* Hızlı İşlem */}
            {showQuickActions ? (
              <div className="relative" ref={quickActionRef}>
                <button
                  type="button"
                  onClick={() => setQuickActionOpen((v) => !v)}
                  className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  aria-expanded={quickActionOpen}
                  aria-haspopup="menu"
                >
                  <Zap className="h-3.5 w-3.5 text-status-warning" />
                  <span>Hızlı İşlem</span>
                  <ChevronDown className={`h-3.5 w-3.5 transition ${quickActionOpen ? 'rotate-180' : ''}`} />
                </button>
                {quickActionOpen ? (
                  <div
                    role="menu"
                    className="absolute right-0 top-full z-50 mt-1.5 w-56 overflow-hidden rounded-xl border border-slate-100 bg-white py-1.5 shadow-xl"
                  >
                    {canCreateHasar ? (
                      <Link
                        href="/panel/hasar-dosyalari?yeni=1"
                        role="menuitem"
                        className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-blue-50 hover:text-blue-700"
                        onClick={() => setQuickActionOpen(false)}
                      >
                        <HASAR_OPERATION_ICON className="h-4 w-4 text-brand-600" />
                        Yeni Hasar
                      </Link>
                    ) : null}
                    {canCreateAcil ? (
                      <Link
                        href="/panel/operasyon?filter=acil&yeni=1"
                        role="menuitem"
                        className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-red-50 hover:text-red-700"
                        onClick={() => setQuickActionOpen(false)}
                      >
                        <ACIL_OPERATION_ICON className="h-4 w-4 text-red-600" />
                        Yeni Acil
                      </Link>
                    ) : null}
                    {canOpenMonday ? (
                      <Link
                        href="/panel/pazartesi-toplantisi"
                        role="menuitem"
                        className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                        onClick={() => setQuickActionOpen(false)}
                      >
                        <CalendarDays className="h-4 w-4 text-brand-600" />
                        Pazartesi Toplantısı
                      </Link>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Bildirim */}
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={onNotifOpen}
                className="relative flex items-center justify-center w-9 h-9 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute top-0.5 right-0.5 flex items-center justify-center min-w-[16px] h-4 px-0.5 rounded-full bg-status-danger text-white text-[9px] font-bold">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <>
                  <div className="absolute right-0 top-full z-50 mt-2 w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-slate-100/80 bg-white shadow-xl">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/80">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-800">Bildirimler</span>
                        {unreadCount > 0 && (
                          <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-status-danger text-white text-[10px] font-bold">
                            {unreadCount > 99 ? '99+' : unreadCount}
                          </span>
                        )}
                      </div>
                      {unreadCount > 0 && (
                        <button type="button" onClick={onMarkAllRead} className="text-xs text-brand-600 hover:text-blue-700 font-medium">
                          Tümünü Okundu İşaretle
                        </button>
                      )}
                    </div>
                    <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-50">
                      {notifications.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                          <svg className="w-10 h-10 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                          </svg>
                          <p className="text-sm text-slate-400">Henüz bildirim yok</p>
                        </div>
                      ) : (
                        notifications.map((notif) => (
                          <button
                            key={notif.id}
                            type="button"
                            onClick={() => onNotifClick(notif)}
                            className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors ${notifTypeBorder(notif.type)} ${notif.status !== 'read' ? 'bg-blue-50/30' : ''}`}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`mt-0.5 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm ${notifTypeColor(notif.type)}`}>
                                {notifTypeIcon(notif.type)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-slate-800 leading-snug line-clamp-1">{notif.title}</p>
                                <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{notif.body}</p>
                                <p className="text-[10px] text-slate-400 mt-1">{isHydrated ? relativeTime(notif.createdAt) : null}</p>
                              </div>
                              {notif.status !== 'read' && <span className="shrink-0 mt-1.5 w-2 h-2 rounded-full bg-blue-500" />}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                    <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between">
                      <Link href="/panel/bildirimler" className="text-xs text-brand-600 hover:text-blue-700 font-medium" onClick={() => onNotifOpen()}>
                        Tüm Bildirimleri Gör
                      </Link>
                      <span className="text-[10px] text-slate-400">{notifications.length} bildirim</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Yardım → Help Drawer */}
            <button
              type="button"
              onClick={() => helpDrawer?.setOpen(true)}
              className="hidden lg:inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-2 text-slate-500 transition hover:bg-slate-100 hover:text-blue-700 dark:border-slate-700 dark:hover:bg-slate-800"
              title={userGuide?.title ?? 'Yardım'}
              aria-label="Yardım"
            >
              <HelpCircle className="h-4 w-4 text-slate-600 dark:text-slate-300" />
              <span className="hidden text-xs font-medium xl:inline">Yardım</span>
            </button>

            <PanelThemeToggle />

            {/* Profil Dropdown — satır 1: kurum/bağlam · satır 2: ad soyad (band büyümesin) */}
            <div className="relative z-[60] min-w-0 max-w-[10rem] sm:max-w-[12rem] lg:max-w-[14rem]" ref={profileDropRef}>
              <button
                type="button"
                onClick={() => setProfileDropOpen((v) => !v)}
                className="relative z-[60] flex max-w-full items-center gap-2 rounded-xl py-1 pl-1.5 pr-1 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:pr-1.5 dark:hover:bg-slate-800"
                title={[profileContextLabel, `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim()].filter(Boolean).join(' · ') || 'Profil'}
                aria-expanded={profileDropOpen}
                aria-haspopup="menu"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white shadow-sm shadow-blue-200">
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </div>
                <span className="hidden min-w-0 flex-col items-start leading-tight sm:flex">
                  {profileContextLabel ? (
                    <span className="max-w-full truncate text-[10px] font-medium text-slate-500 dark:text-slate-400">
                      {profileContextLabel}
                    </span>
                  ) : null}
                  <span className="max-w-full truncate text-xs font-semibold text-slate-700 dark:text-slate-200">
                    {user?.firstName} {user?.lastName}
                  </span>
                </span>
                <svg className="hidden h-3 w-3 shrink-0 text-slate-400 sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {profileDropOpen && (
                <>
                  <div
                    role="menu"
                    className="absolute right-0 top-full z-[70] mt-1.5 w-56 rounded-2xl border border-slate-100/80 bg-white py-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900"
                  >
                    <div className="border-b border-slate-100 px-4 py-2.5 dark:border-slate-700">
                      {profileContextLabel ? (
                        <p className="truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">{profileContextLabel}</p>
                      ) : null}
                      <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{user?.firstName} {user?.lastName}</p>
                      <p className="truncate text-xs text-slate-400">{user?.role?.name ?? roleCode}</p>
                    </div>
                    <Link href="/panel/profil" className="flex items-center gap-2 mx-1 px-3 py-2.5 text-sm text-slate-700 hover:bg-blue-50/60 hover:text-blue-700 rounded-lg transition-colors">
                      <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Profilim
                    </Link>
                    <button type="button"
                      onClick={onLogout}
                      className="w-full flex items-center gap-2 mx-1 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Çıkış Yap
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Sistem Durumu → Sistem Sağlık paneli */}
            {!isPortalUser ? <PanelSystemHealth /> : null}

            {/* Mobil hamburger — portal kullanıcılarında alt menü var; yalnızca profil/çıkış */}
            <button
              type="button"
              className="md:hidden flex items-center justify-center w-9 h-9 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label={isPortalUser ? 'Hesap Menüsü' : 'Menü'}
            >
              {mobileMenuOpen ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
              )}
            </button>
          </div>
        </div>
      </div>

        {/* MOBILE_SHELL_LOCK: menü h-14 DIŞINDA + fixed — header yüksekliği sabit kalsın */}
        {mobileMenuOpen ? (
          <>
            <div
              className="fixed inset-0 top-14 z-40 bg-black/30 md:hidden"
              aria-hidden
              onClick={() => setMobileMenuOpen(false)}
            />
            <div
              className="fixed left-0 right-0 top-14 z-50 max-h-[min(70vh,calc(100dvh-3.5rem))] w-full overflow-x-hidden overflow-y-auto overscroll-contain border-b border-slate-100 bg-white py-3 shadow-lg md:hidden dark:border-slate-800 dark:bg-slate-950"
              role="navigation"
              aria-label="Mobil Menü"
            >
              <div className="space-y-0.5 px-1">
                {!isPortalUser
                  ? visibleMainLinks.map((link) => {
                      const visibleChildren = (link.children ?? []).filter((child) => canSee(child.href));
                      const hasChildren = visibleChildren.length > 0;
                      const childIsActive = hasChildren
                        && visibleChildren.some((child) => {
                          const pathOnly = child.href.split('?')[0] || child.href;
                          if (pathOnly === '/panel') return pathname === '/panel';
                          return pathname === pathOnly || pathname.startsWith(`${pathOnly}/`);
                        });
                      const isExpanded = hasChildren
                        ? (mobileExpandedGroups[link.href] ?? childIsActive)
                        : false;

                      return (
                        <div key={`${link.href}:${link.title}`} className="space-y-0.5">
                          <div className="flex items-stretch gap-0.5">
                            <Link
                              href={link.href}
                              className={`flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-blue-50/60 hover:text-blue-700 dark:hover:bg-slate-800 ${
                                childIsActive || pathname === link.href.split('?')[0]
                                  ? 'bg-blue-50/50 text-blue-700 dark:bg-slate-800 dark:text-blue-300'
                                  : 'text-slate-700 dark:text-slate-200'
                              }`}
                              onClick={() => setMobileMenuOpen(false)}
                            >
                              <span className="inline-flex min-w-0 items-center gap-2">
                                {link.icon ? <link.icon className="h-4 w-4 shrink-0 text-slate-400" /> : null}
                                <span className="truncate">{link.title}</span>
                              </span>
                              {link.alertCount && link.alertCount > 0 ? (
                                <span className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-status-danger px-1.5 py-0.5 text-[10px] font-bold text-white">
                                  {link.alertCount > 99 ? '99+' : link.alertCount}
                                </span>
                              ) : null}
                            </Link>
                            {hasChildren ? (
                              <button
                                type="button"
                                className="flex w-10 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                                aria-label={isExpanded ? `${link.title} alt menüsünü kapat` : `${link.title} alt menüsünü aç`}
                                aria-expanded={isExpanded}
                                onClick={() =>
                                  setMobileExpandedGroups((prev) => ({
                                    ...prev,
                                    [link.href]: !isExpanded,
                                  }))
                                }
                              >
                                <ChevronDown
                                  className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                  strokeWidth={1.75}
                                />
                              </button>
                            ) : null}
                          </div>
                          {hasChildren && isExpanded ? (
                            <div className="ml-4 space-y-0.5 border-l border-slate-100 pl-2 dark:border-slate-800">
                              {visibleChildren.map((child) => {
                                const pathOnly = child.href.split('?')[0] || child.href;
                                const active =
                                  pathname === pathOnly || pathname.startsWith(`${pathOnly}/`);
                                return (
                                  <Link
                                    key={`${child.href}:${child.title}`}
                                    href={child.href}
                                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-blue-50/60 hover:text-blue-700 dark:hover:bg-slate-800 ${
                                      active
                                        ? 'bg-blue-50/50 text-blue-700 dark:bg-slate-800 dark:text-blue-300'
                                        : 'text-slate-600 dark:text-slate-300'
                                    }`}
                                    onClick={() => setMobileMenuOpen(false)}
                                  >
                                    <span className="truncate">{child.title}</span>
                                  </Link>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>
                      );
                    })
                  : (
                      <>
                        <p className="px-3 pb-2 text-xs text-slate-500">
                          Sayfa geçişleri ekranın altındaki menüden yapılır.
                        </p>
                        {userGuide ? (
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-50/60"
                            onClick={() => {
                              setMobileMenuOpen(false);
                              helpDrawer?.setOpen(true);
                            }}
                          >
                            <BookOpen className="h-4 w-4 shrink-0 text-brand-600" />
                            {userGuide.title}
                          </button>
                        ) : null}
                      </>
                    )}
                <div className={`border-t border-slate-100 pt-2 dark:border-slate-800 ${isPortalUser ? '' : 'mt-2'}`}>
                  {userGuide && !isPortalUser ? (
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-50/60"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        helpDrawer?.setOpen(true);
                      }}
                    >
                      <BookOpen className="h-4 w-4 shrink-0 text-brand-600" />
                      {userGuide.title}
                    </button>
                  ) : null}
                  <Link
                    href="/panel/profil"
                    className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-blue-50/60 hover:text-blue-700 dark:text-slate-200"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Profilim
                  </Link>
                  <button
                    type="button"
                    onClick={() => { setMobileMenuOpen(false); onLogout(); }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-red-600 transition-colors hover:bg-red-50"
                  >
                    Çıkış Yap
                  </button>
                  <p className="truncate px-3 pt-2 text-center text-[10px] font-medium text-slate-400 dark:text-slate-500">
                    Web {PANEL_WEB_VERSION} · {PANEL_BACKEND_VERSION.replace(/^v/, 'v')} · Kılavuz {GUIDE_CONTENT_VERSION}
                  </p>
                </div>
              </div>
            </div>
          </>
        ) : null}
    </header>
  );
}

function isSettingsPath(pathname: string) {
  return pathname === '/panel/ayarlar' || pathname.startsWith('/panel/ayarlar/');
}

function isAdminContentPath(pathname: string) {
  return (
    isSettingsPath(pathname)
    || pathname.startsWith('/panel/kullanicilar')
    || pathname.startsWith('/panel/guvenlik')
    || pathname.startsWith('/panel/admin')
  );
}

function PanelSidebar({
  pathname,
  roleCode,
  isPortalUser,
  isExpert,
  isInsuranceCompanyUser,
  isAssistanceCompanyUser,
  isFinance,
  isFieldStaff,
  pendingRevisionCount,
  allowedScreens,
  collapsed,
  onToggleCollapsed,
  hidden = false,
}: PanelSidebarProps) {
  const [expandedGroupOverrides, setExpandedGroupOverrides] = useState<Record<string, boolean>>({});
  // Eksper Portalı'nda Dosyalarım / Onay Bekliyor / Rapor Bekleyenler / Onaylanan Dosyalar
  // aynı sayfayı farklı ?queue= filtresiyle açar. pathname tek başına bunları ayıramadığı için
  // (useSearchParams paylaşılan layout'ta build hatasına yol açtığından) query'yi burada
  // window.location üzerinden takip ediyoruz.
  const [activeQueueParam, setActiveQueueParam] = useState<string | null>(null);
  const [expertNavCounts, setExpertNavCounts] = useState<ExpertPortalNavCounts>({});
  const [insuranceNavCounts, setInsuranceNavCounts] = useState<InsurancePortalNavCounts>({});

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const readQueue = () => setActiveQueueParam(new URLSearchParams(window.location.search).get('queue'));
    readQueue();
    window.addEventListener('popstate', readQueue);
    return () => window.removeEventListener('popstate', readQueue);
  }, [pathname]);

  useEffect(() => {
    if (!isExpert) {
      setExpertNavCounts({});
      return;
    }
    let cancelled = false;
    const token = getAccessToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    (async () => {
      try {
        const filesRes = await fetch(`${API_BASE}/claim-files?limit=100`, { headers });
        const filesJson = filesRes.ok ? await filesRes.json() : null;
        const files = filesJson?.data ?? [];
        const queues = countExpertQueues(files);

        if (!cancelled) {
          setExpertNavCounts({
            onay: queues.onay,
          });
        }
      } catch {
        if (!cancelled) setExpertNavCounts({});
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isExpert, pathname]);

  useEffect(() => {
    if (!isInsuranceCompanyUser) {
      setInsuranceNavCounts({});
      return;
    }
    let cancelled = false;
    const token = getAccessToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/external-approvals/pending`, { headers });
        const json = res.ok ? await res.json() : null;
        const list = json?.data ?? [];
        if (!cancelled) setInsuranceNavCounts({ onay: Array.isArray(list) ? list.length : 0 });
      } catch {
        if (!cancelled) setInsuranceNavCounts({});
      }
    })();
    return () => { cancelled = true; };
  }, [isInsuranceCompanyUser, pathname]);

  if (hidden) return null;

  const isOfficeStaff = isOfficeStaffRole(roleCode);

  const canSee = (path: string) =>
    allowedScreens !== null
      ? canSeeNavItemDynamic(path, allowedScreens, roleCode)
      : canSeeNavItem(path, roleCode);

  const isActive = (href: string, exactMatch?: boolean) => {
    const [normalizedHref, hrefQueryString = ''] = href.split('?');
    const pathMatches = exactMatch
      ? pathname === normalizedHref
      : normalizedHref === '/panel'
        ? pathname === '/panel'
        : pathname === normalizedHref || pathname.startsWith(normalizedHref + '/');
    if (!pathMatches) return false;
    // Aynı gerekçeyle: yalnızca gerçekten seçili olan queue filtresi vurgulansın,
    // aynı sayfadaki tüm alt filtreler birden aktif görünmesin.
    if (normalizedHref === '/panel/eksper-portal/dosyalar') {
      const hrefQueue = normalizeExpertQueueParam(new URLSearchParams(hrefQueryString).get('queue'));
      const activeQueue = normalizeExpertQueueParam(activeQueueParam);
      return hrefQueue === activeQueue;
    }
    return true;
  };

  const mainLinks = getPanelMainLinks({
    isExpert,
    isInsuranceCompanyUser,
    isAssistanceCompanyUser,
    isOfficeStaff: isOfficeStaffRole(roleCode),
    isFinance,
    isFieldStaff,
    pendingRevisionCount,
    expertNavCounts,
    insuranceNavCounts,
    assistanceNavCounts: insuranceNavCounts,
  });

  const visibleMainLinks = isPortalUser ? mainLinks : mainLinks.filter((link) => canSee(link.href));

  const linkClass = (
    href: string,
    compact = false,
    forceActive?: boolean,
    exactMatch?: boolean,
    isFirst = false,
  ) => {
    const active = forceActive ?? isActive(href, exactMatch);
    const sizeClass = compact
      ? 'panel-sidebar-nav-link--compact'
      : isFirst
        ? 'panel-sidebar-nav-link--first'
        : 'panel-sidebar-nav-link--default';
    return `panel-sidebar-nav-link ${sizeClass}${active ? ' panel-sidebar-nav-link--active' : ''}`;
  };

  const getNavTooltipLabel = (link: NavigationLink) => {
    if (link.alertCount && link.alertCount > 0) {
      return `${link.title} (${link.alertCount})`;
    }
    return link.title;
  };

  const renderNavLink = (link: NavigationLink, compact = false, isFirst = false) => {
    const tooltipLabel = getNavTooltipLabel(link);
    const hasChildren = !!link.children?.length;
    const childIsActive = hasChildren
      ? link.children!.some((child) => isActive(child.href, child.exactMatch))
      : false;
    const isExpanded = hasChildren
      ? expandedGroupOverrides[link.href] ?? childIsActive
      : false;

    const linkNode = (
      <Link
        href={link.href}
        className={`${linkClass(link.href, compact, undefined, link.exactMatch, isFirst)}${collapsed ? ' relative justify-center px-2' : hasChildren ? ' flex-1 min-w-0' : ''}`}
        aria-label={collapsed ? tooltipLabel : undefined}
        onClick={() => {
          if (hasChildren && !collapsed) {
            setExpandedGroupOverrides((prev) => ({ ...prev, [link.href]: !isExpanded }));
          }
          const hrefQueryString = link.href.split('?')[1] ?? '';
          setActiveQueueParam(new URLSearchParams(hrefQueryString).get('queue'));
        }}
      >
        <span className={`inline-flex min-w-0 items-center ${collapsed ? 'justify-center w-full' : 'gap-2.5'}`}>
          {link.icon ? <link.icon className="panel-sidebar-nav-icon" strokeWidth={1.75} /> : null}
          {!collapsed ? <span className="truncate">{link.title}</span> : null}
        </span>
        {!collapsed && link.alertCount != null && link.alertCount > 0 ? (
          <span
            className={`ml-auto inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums ${
              isExpert
                ? 'bg-rose-100 text-rose-700 ring-1 ring-rose-200/80'
                : 'bg-status-danger text-white'
            }`}
          >
            {link.alertCount > 99 ? '99+' : link.alertCount}
          </span>
        ) : null}
        {collapsed && link.alertCount != null && link.alertCount > 0 ? (
          <span
            className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-status-danger"
            aria-hidden="true"
          />
        ) : null}
      </Link>
    );

    return (
      <div
        key={link.href}
        className={`panel-sidebar-nav-group space-y-0.5${link.groupStart ? ' panel-sidebar-nav-group--start' : ''}`}
      >
        <div className={`flex items-stretch gap-1${collapsed ? ' justify-center' : ''}`}>
          <SidebarNavTooltip label={tooltipLabel} collapsed={collapsed}>
            {linkNode}
          </SidebarNavTooltip>
          {hasChildren && !collapsed ? (
            <button
              type="button"
              onClick={() =>
                setExpandedGroupOverrides((prev) => ({ ...prev, [link.href]: !isExpanded }))
              }
              className="flex shrink-0 items-center justify-center rounded-lg px-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              aria-label={isExpanded ? `${link.title} alt menüsünü kapat` : `${link.title} alt menüsünü aç`}
              aria-expanded={isExpanded}
            >
              <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} strokeWidth={1.75} />
            </button>
          ) : null}
        </div>
        {hasChildren && (isExpanded || collapsed) ? (
          <div className={collapsed ? 'space-y-0.5' : 'panel-sidebar-nav-children'}>
            {link.children!.map((child) => renderNavLink(child, true))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <aside
      className={`z-30 hidden h-full flex-col self-stretch overflow-hidden border-r border-[#E5E7EB] bg-white text-[#0F172A] shadow-sm transition-[width] duration-200 ease-in-out dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 md:flex ${
        collapsed ? PANEL_SIDEBAR_WIDTH_COLLAPSED : PANEL_SIDEBAR_WIDTH_EXPANDED
      }`}
      style={
        collapsed
          ? { width: 72, minWidth: 72, maxWidth: 72 }
          : { width: 260, minWidth: 260, maxWidth: 260 }
      }
    >
      {/* RC1: sidebar logo yok — marka topbar BrandLogo */}
      <nav className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 pt-3 pb-3 [scrollbar-width:thin]">
        <div className="flex flex-col">
          {visibleMainLinks.map((link, index) => renderNavLink(link, false, index === 0))}
        </div>
      </nav>

      <div className="shrink-0">
        <PanelSidebarGuideFooter
          roleCode={roleCode}
          isExpert={isExpert}
          isInsuranceCompanyUser={isInsuranceCompanyUser}
          isFinance={isFinance}
          isFieldStaff={isFieldStaff}
          isOfficeStaff={isOfficeStaff}
          collapsed={collapsed}
          onToggleCollapsed={onToggleCollapsed}
        />
      </div>
    </aside>
  );
}

// ── Ana Layout ────────────────────────────────────────────────────────────────
interface PendingAgreement {
  id: string;
  title: string;
  type: string;
  version: string;
}

function normalizePendingAgreements(raw: unknown): PendingAgreement[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object' && Array.isArray((raw as { data?: unknown }).data)) {
    return (raw as { data: PendingAgreement[] }).data;
  }
  return [];
}

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30000,
            retry: 1,
            refetchOnWindowFocus: true,
          },
        },
      }),
  );
  const router = useRouter();
  const tryNavigateRef = useRef<(proceed: () => void, intent?: 'leave' | 'logout') => void>((proceed) => proceed());
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingRevisionCount, setPendingRevisionCount] = useState(0);
  const [inboxPendingCount, setInboxPendingCount] = useState(0);
  const [pendingAgreements, setPendingAgreements] = useState<PendingAgreement[]>([]);
  const [agreementsChecked, setAgreementsChecked] = useState(false);
  const [agreementModalDismissed, setAgreementModalDismissed] = useState(false);
  const [allowedScreens, setAllowedScreens] = useState<string[] | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  // Tema — manuel seçim veya günün saatine göre (06:00–18:00 açık)
  useEffect(() => {
    const readTheme = (): StoredThemeConfig | null => {
      try {
        const raw = localStorage.getItem('app-theme');
        if (!raw) return null;
        return JSON.parse(raw) as StoredThemeConfig;
      } catch {
        return null;
      }
    };

    const applyTheme = () => applyPanelThemeToDocument(readTheme());

    applyTheme();
    const onStorage = (e: StorageEvent) => { if (e.key === 'app-theme') applyTheme(); };
    const onCustom = () => applyTheme();
    const hourly = window.setInterval(applyTheme, 60 * 60 * 1000);
    window.addEventListener('storage', onStorage);
    window.addEventListener('theme-changed', onCustom);
    return () => {
      window.clearInterval(hourly);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('theme-changed', onCustom);
    };
  }, []);

  // Scroll reset: route değişiminde sayfayı yukarı sıfırla
  const mainRef = useRef<HTMLDivElement>(null);
  const notifPanelRef = useRef<HTMLDivElement>(null);

  // Bildirim paneli dışarı tıklamada kapat
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifPanelRef.current && !notifPanelRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    if (notifOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [notifOpen]);
  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
    // window scroll da sıfırla
    window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    installAxiosAuthInterceptors();
  }, []);

  useEffect(() => {
    const token = getAccessToken();
    if (!token || !hasValidSessionScope() || isRememberMeExpired() || isRememberMeInactive()) {
      clearAuth({ preserveRememberedEmail: isRememberMePreferred() });
      setLoading(false);
      setAuthChecked(true);
      router.push('/giris');
      return;
    }
    const apiBase = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}`.replace(/\/$/, '').replace(/\/api\/v1$/, '/api/v1');
    axios.get(`${apiBase}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((response) => {
        const me = response.data?.data ?? response.data;
        if (me) {
          setUser(me);
          localStorage.setItem('user', JSON.stringify(me));
          window.dispatchEvent(new Event('meridyen:user-updated'));
        } else {
          throw new Error('auth/me boş döndü');
        }
        return axios.get(`${apiBase}/users/me/permissions`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((permResponse) => ({ me, permResponse }));
      })
      .then(({ me, permResponse }) => {
        const data = permResponse.data?.data ?? permResponse.data;
        const role = me?.role?.code ?? '';
        const screens = Array.isArray(data?.screens) && data.screens.length > 0
          ? data.screens
          : getDefaultScreensForRole(role);
        setAllowedScreens(screens);
      })
      .catch(async (error) => {
        if (axios.isAxiosError(error) && error.response?.status === 403) {
          const payload = error.response.data as { message?: string | { code?: string; message?: string }; code?: string };
          const message = typeof payload?.message === 'string'
            ? payload.message
            : payload?.message?.message;
          const code = payload?.code ?? (typeof payload?.message === 'object' ? payload.message?.code : undefined);
          if (code === 'AGREEMENTS_PENDING' || (typeof message === 'string' && message.includes('sözleşme'))) {
            return;
          }
        }
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          const refreshToken = getRefreshToken();
          if (refreshToken) {
            try {
              const refreshResponse = await axios.post(`${apiBase}/auth/refresh`, {
                refreshToken,
              });
              const tokens = refreshResponse.data?.data;
              if (tokens?.accessToken && tokens?.refreshToken) {
                persistTokens(tokens.accessToken, tokens.refreshToken);
                const retryMe = await axios.get(`${apiBase}/auth/me`, {
                  headers: { Authorization: `Bearer ${tokens.accessToken}` },
                });
                const me = retryMe.data?.data ?? retryMe.data;
                if (me) {
                  setUser(me);
                  localStorage.setItem('user', JSON.stringify(me));
                  window.dispatchEvent(new Event('meridyen:user-updated'));
                  const permissions = await axios.get(`${apiBase}/users/me/permissions`, {
                    headers: { Authorization: `Bearer ${tokens.accessToken}` },
                  });
                  const permData = permissions.data?.data ?? permissions.data;
                  const screens = Array.isArray(permData?.screens) && permData.screens.length > 0
                    ? permData.screens
                    : getDefaultScreensForRole(me?.role?.code ?? '');
                  setAllowedScreens(screens);
                  return;
                }
              }
            } catch {}
          }
        }
        clearAuth({ preserveRememberedEmail: isRememberMePreferred() });
        router.push('/giris');
      })
      .finally(() => {
        setLoading(false);
        setAuthChecked(true);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Oturum token'ı 15 dk'da doluyor; panel açıkken periyodik yenileme
  useEffect(() => {
    const apiBase = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}`.replace(/\/$/, '').replace(/\/api\/v1$/, '/api/v1');
    const refreshSession = () => {
      if (getAccessToken() && hasValidSessionScope()) {
        void ensureValidSession(apiBase);
      }
    };
    refreshSession();
    const intervalId = window.setInterval(refreshSession, SESSION_KEEPALIVE_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshSession();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // Onaylanmamış sözleşme kontrolü
  const loadPendingAgreements = useCallback(async () => {
    if (!getAccessToken()) {
      setAgreementsChecked(true);
      return;
    }
    try {
      const data = await apiClient.get<PendingAgreement[]>('/agreements/pending');
      setPendingAgreements(normalizePendingAgreements(data));
    } catch {
      setPendingAgreements([]);
    } finally {
      setAgreementsChecked(true);
    }
  }, []);

  useEffect(() => {
    if (loading || !authChecked) return;
    void loadPendingAgreements();
  }, [loading, authChecked, loadPendingAgreements]);

  useEffect(() => {
    const handleRefetch = () => { void loadPendingAgreements(); };
    const handleUserUpdated = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail) setUser(detail);
    };
    window.addEventListener('agreements-refetch', handleRefetch);
    window.addEventListener('user-updated', handleUserUpdated);
    return () => {
      window.removeEventListener('agreements-refetch', handleRefetch);
      window.removeEventListener('user-updated', handleUserUpdated);
    };
  }, [loadPendingAgreements]);

  useEffect(() => {
    if (loading || !agreementsChecked) return;
    if (pendingAgreements.length > 0) return;
    if (user?.mustChangePassword && pathname !== '/panel/profil') {
      router.replace('/panel/profil');
    }
  }, [loading, agreementsChecked, pendingAgreements.length, user?.mustChangePassword, pathname, router]);

  const fetchUnreadCount = useCallback(async () => {
    try {
      if (!getAccessToken()) return;
      const data = await apiClient.get<{ count?: number }>('/notifications/unread-count');
      setUnreadCount(data?.count ?? 0);
    } catch {}
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      if (!getAccessToken()) return;
      const data = await apiClient.get<AppNotification[]>('/notifications', { limit: 20 });
      setNotifications(data ?? []);
    } catch {}
  }, []);

  useEffect(() => {
    if (!loading && authChecked) {
      fetchUnreadCount();
      const interval = setInterval(fetchUnreadCount, 60000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [loading, fetchUnreadCount]);

  useEffect(() => {
    let cancelled = false;
    const checkMaintenance = async () => {
      try {
        const res = await axios.get(`${API_BASE}/health`, { timeout: 8000 });
        if (!cancelled) {
          setMaintenanceMode(Boolean(res.data?.maintenanceMode));
        }
      } catch {
        if (!cancelled) setMaintenanceMode(false);
      }
    };
    checkMaintenance();
    const interval = setInterval(checkMaintenance, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!loading && authChecked) {
      if (!getAccessToken()) return;
      apiClient.getWithMeta<any[], { total?: number }>('/revision-requests', { status: 'REQUESTED', limit: 1 })
        .then((json) => { if (json) setPendingRevisionCount(json?.meta?.total ?? json?.data?.length ?? 0); })
        .catch(() => { setPendingRevisionCount(0); });

      apiClient
        .get<{ pending?: number; unownedCount?: number }>('/operation-inbox/stats')
        .then((inbox) => {
          const inboxCount = inbox?.unownedCount ?? inbox?.pending ?? 0;
          setInboxPendingCount(typeof inboxCount === 'number' ? inboxCount : 0);
        })
        .catch(() => setInboxPendingCount(0));
    }
  }, [loading, authChecked]);

  const handleNotifOpen = async () => {
    const newOpen = !notifOpen;
    setNotifOpen(newOpen);
    if (newOpen) await fetchNotifications();
  };

  const handleMarkRead = async (notifId: string) => {
    try {
      if (!getAccessToken()) return;
      await apiClient.patch(`/notifications/${notifId}/read`);
      setNotifications((prev) => prev.map((n) => (n.id === notifId ? { ...n, status: 'read' } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {}
  };

  const handleMarkAllRead = async () => {
    try {
      if (!getAccessToken()) return;
      await apiClient.patch('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, status: 'read' })));
      setUnreadCount(0);
    } catch {}
  };

  const handleNotifClick = async (notif: AppNotification) => {
    if (notif.status !== 'read') await handleMarkRead(notif.id);
    setNotifOpen(false);
    if (notif.relatedEntityType === 'claim_file' && notif.relatedEntityId) {
      router.push(`/panel/hasar-dosyalari/${notif.relatedEntityId}`);
      return;
    }
    if (
      (notif.relatedEntityType === 'emergency_case' || notif.relatedEntityType === 'emergency')
      && notif.relatedEntityId
    ) {
      router.push(`/panel/acil-yardim/${notif.relatedEntityId}`);
      return;
    }
    if (notif.relatedEntityType === 'inbound_message' && notif.relatedEntityId) {
      router.push(`/panel/operasyon/gelen-kutusu?messageId=${notif.relatedEntityId}`);
    }
  };

  const handleLogout = () => {
    tryNavigateRef.current(() => {
      void logoutAndRedirect(API, (url) => {
        router.push(url);
      }, 'logout');
    }, 'logout');
  };

  const notifTypeColor = (type: string) => {
    if (type === 'revision_request') return 'bg-orange-100 text-orange-800';
    if (type === 'file_assignment') return 'bg-blue-100 text-blue-800';
    if (type === 'file_closed') return 'bg-slate-100 text-slate-700';
    if (type === 'pending_approval') return 'bg-yellow-100 text-yellow-800';
    if (type === 'overdue' || type === 'sla_violation') return 'bg-red-100 text-red-800';
    if (type === 'birthday') return 'bg-pink-100 text-pink-800';
    return 'bg-slate-100 text-slate-700';
  };
  const notifTypeBorder = (type: string) => {
    if (type === 'revision_request') return 'border-l-4 border-orange-400';
    if (type === 'file_assignment') return 'border-l-4 border-blue-400';
    if (type === 'file_closed') return 'border-l-4 border-slate-400';
    if (type === 'pending_approval') return 'border-l-4 border-yellow-400';
    if (type === 'overdue' || type === 'sla_violation') return 'border-l-4 border-status-danger';
    if (type === 'birthday') return 'border-l-4 border-pink-400';
    return 'border-l-4 border-slate-300';
  };
  const notifTypeIcon = (type: string) => {
    if (type === 'revision_request') return '↩';
    if (type === 'file_assignment') return '📁';
    if (type === 'file_closed') return '✓';
    if (type === 'pending_approval') return '⏳';
    if (type === 'overdue' || type === 'sla_violation') return '⚠';
    if (type === 'birthday') return '🎂';
    return 'ℹ';
  };
  const relativeTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Az önce';
    if (mins < 60) return `${mins} dk önce`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} saat önce`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days} gün önce`;
    return new Date(dateStr).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  };

  const roleCode: string = user?.role?.code ?? '';
  const operationArea = userOperationArea(user);
  const isExpert = roleCode === 'expert';
  const isInsuranceCompanyUser = roleCode === 'insurance_company_user';
  const isAssistanceCompanyUser = roleCode === 'assistance_company_user';
  const isPortalUser = isExpert || isInsuranceCompanyUser || isAssistanceCompanyUser;
  const isFinance = isFinanceRole(roleCode);
  const isFieldStaff = isFieldStaffRole(roleCode);
  const showAcilYardim = canAccessAcilYardim(roleCode, operationArea, user?.operationalAccessGrants);

  useEffect(() => {
    if (!loading && isExpert && pathname === '/panel') router.replace('/panel/eksper-portal');
    if (!loading && isInsuranceCompanyUser && pathname === '/panel') router.replace('/panel/sigorta-portal');
    if (!loading && isAssistanceCompanyUser && pathname === '/panel') router.replace('/panel/asistans-portal');
    if (!loading && isFinance && pathname === '/panel') router.replace('/panel/finans');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, roleCode]);

  const isPublicPanelPath = pathname === '/panel/profil';
  const mustChangePassword = user?.mustChangePassword === true;
  const accessDenied =
    !loading
    && allowedScreens !== null
    && !isPublicPanelPath
    && !mustChangePassword
    && roleCode !== ''
    && !hasPanelRouteAccess(pathname, roleCode, operationArea, user?.operationalAccessGrants, allowedScreens);

  const safeHomePath = getSafePanelHomePath(roleCode);
  const safeHomeLabel =
    safeHomePath === '/panel/eksper-portal'
      ? 'Eksper Paneline Dön'
      : safeHomePath === '/panel/sigorta-portal'
        ? 'Dosya Takibe Dön'
        : safeHomePath === '/panel/asistans-portal'
          ? 'Dosya Takibe Dön'
        : safeHomePath === '/panel/finans'
          ? 'Finans Merkezine Dön'
          : 'Panele Dön';

  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string>('Meridyen Assistance');

  useEffect(() => {
    axios.get(`${API_BASE}/system-settings/company-info`)
      .then((r) => {
        const d = r.data?.data ?? {};
        if (d.logoUrl) {
          const isDataUri = d.logoUrl.startsWith('data:');
          const busted = isDataUri ? d.logoUrl : (d.logoUrl.includes('?') ? d.logoUrl : `${d.logoUrl}?v=${Date.now()}`);
          setCompanyLogo(busted);
        }
        if (d.name) setCompanyName(d.name);
      })
      .catch(() => {});
  }, []);

  const userGuide = resolvePanelUserGuide({
    roleCode,
    isExpert,
    isInsuranceCompanyUser,
    isFinance,
    isFieldStaff,
    isOfficeStaff: isOfficeStaffRole(roleCode),
  });

  const contextBackLink = isSettingsPath(pathname) ? null : getContextBackLink(pathname);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    try {
      setSidebarCollapsed(localStorage.getItem('panel-sidebar-collapsed') === 'true');
    } catch {
      /* localStorage kullanılamıyorsa varsayılan geniş menü */
    }
  }, []);

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed((value) => {
      const next = !value;
      try {
        localStorage.setItem('panel-sidebar-collapsed', String(next));
      } catch {
        /* sessiz */
      }
      return next;
    });
  };

  const operationBadgeCount = pendingRevisionCount + inboxPendingCount;

  const navbarProps = {
    user, pathname, roleCode, isPortalUser, isExpert, isInsuranceCompanyUser, isAssistanceCompanyUser,
    pendingRevisionCount: operationBadgeCount, onLogout: handleLogout,
    unreadCount, notifOpen, onNotifOpen: handleNotifOpen,
    onNotifClose: () => setNotifOpen(false),
    notifications, onMarkRead: handleMarkRead, onMarkAllRead: handleMarkAllRead,
    onNotifClick: handleNotifClick, relativeTime, notifTypeColor, notifTypeBorder, notifTypeIcon,
    allowedScreens, companyLogo, companyName,
    isFinance, isFieldStaff, showAcilYardim,
    userGuide,
    onToggleSidebar: toggleSidebarCollapsed,
    sidebarCollapsed,
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <LoadingScreen />
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar {...navbarProps} />
        <main className="flex-1 flex flex-col items-center justify-center px-4">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-status-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m0 0v2m0-2h2m-2 0H10m2-11a2 2 0 00-2 2v6a2 2 0 004 0V8a2 2 0 00-2-2zm-7 9a9 9 0 1118 0 9 9 0 01-18 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Yetkiniz Bulunmamaktadır</h2>
            <p className="text-slate-500 text-sm mb-6">
              Bu sayfayı görüntülemek için gerekli yetkiye sahip değilsiniz. Adres çubuğundaki bağlantı korunur; geri veya panele dönebilirsiniz.
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              <Link
                href={safeHomePath}
                className="px-5 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 shadow-sm shadow-blue-200/60"
              >
                {safeHomeLabel}
              </Link>
              <button
                type="button"
                onClick={() => router.back()}
                className="px-5 py-2.5 bg-white text-slate-700 border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50 shadow-sm"
              >
                Geri Git
              </button>
            </div>
            <p className="mt-4 text-xs text-slate-400">
              Hata kodu: 403 — Rol: {user?.role?.name ?? roleCode}
              {pathname ? ` · Sayfa: ${pathname}` : ''}
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <PanelUserProvider user={user}>
      <PanelHelpDrawerProvider>
      <NavigationGuardProvider tryNavigateRef={tryNavigateRef}>
      <div className="min-h-screen bg-slate-50 flex flex-col dark:bg-slate-950" ref={mainRef}>
        <Navbar {...navbarProps} />
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <PanelSidebar
            pathname={pathname}
            roleCode={roleCode}
            isPortalUser={isPortalUser}
            isExpert={isExpert}
            isInsuranceCompanyUser={isInsuranceCompanyUser}
            isAssistanceCompanyUser={isAssistanceCompanyUser}
            isFinance={isFinance}
            isFieldStaff={isFieldStaff}
            pendingRevisionCount={operationBadgeCount}
            allowedScreens={allowedScreens}
            collapsed={sidebarCollapsed}
            onToggleCollapsed={toggleSidebarCollapsed}
            hidden={mustChangePassword}
          />
          {/* overflow-x-clip: hidden/auto ara scrollport oluşturup sticky thead’i kırmaz (v329) */}
          <div className="relative min-w-0 flex-1 overflow-y-auto overflow-x-clip bg-slate-50/90 dark:bg-slate-950">
        <GlobalActivityStrip />
        {maintenanceMode && (
          <div className="border-b border-yellow-300 bg-yellow-50 px-4 py-2.5">
            <div className="mx-auto max-w-screen-2xl">
              <p className="text-sm text-yellow-900">
                Sistem bakımda; veri girişi geçici olarak kapalı.
              </p>
            </div>
          </div>
        )}
        {agreementsChecked && pendingAgreements.length > 0 && !agreementModalDismissed && (
          <AgreementConsentModal
            pendingAgreements={pendingAgreements}
            onDismiss={() => setAgreementModalDismissed(true)}
            onAllAccepted={() => {
              setPendingAgreements([]);
              setAgreementModalDismissed(false);
              try {
                const raw = localStorage.getItem('user');
                if (raw) {
                  const parsed = JSON.parse(raw);
                  if (parsed?.mustChangePassword) {
                    router.replace('/panel/profil');
                  }
                }
              } catch {
                /* ignore */
              }
            }}
          />
        )}
        {agreementsChecked && pendingAgreements.length > 0 && agreementModalDismissed && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5">
            <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-amber-900">
                {pendingAgreements.length} sözleşme onayınız bekleniyor. Onaylamadan veri işlemleri (CRM, müşteriler vb.) kısıtlıdır.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAgreementModalDismissed(false)}
                  className="inline-flex h-8 items-center rounded-lg bg-amber-600 px-3 text-xs font-semibold text-white hover:bg-amber-700"
                >
                  Sözleşmeleri Onayla
                </button>
                <Link
                  href="/panel/profil"
                  className="inline-flex h-8 items-center rounded-lg border border-amber-300 px-3 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                >
                  Profilim
                </Link>
              </div>
            </div>
          </div>
        )}
        <main className={`min-w-0 flex-1 overflow-x-clip ${isPortalUser ? 'pb-[calc(4.75rem+env(safe-area-inset-bottom))] md:pb-0' : ''}`}>
          <div className={`mx-auto min-w-0 max-w-screen-2xl px-3 sm:px-4 ${PANEL_MAIN_TOP}`}>
            <TopProgressBar />
            {contextBackLink && (
              <Link
                href={contextBackLink.href}
                className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              >
                <span aria-hidden="true">←</span>
                {contextBackLink.label}
              </Link>
            )}
            <ToastProvider>
              <ErrorBoundary>
                <div className={isAdminContentPath(pathname) ? 'min-w-0 overflow-x-clip' : undefined}>
                  {children}
                </div>
              </ErrorBoundary>
            </ToastProvider>
          </div>
        </main>
        {isPortalUser && !mustChangePassword ? (
          <>
            <PortalWhatsAppLiveSupport />
            <PortalBottomNav variant={isExpert ? 'expert' : isAssistanceCompanyUser ? 'assistance' : 'insurance'} />
          </>
        ) : null}
          </div>
        </div>
        <PanelHelpDrawer
          roleCode={roleCode}
          isExpert={isExpert}
          isInsuranceCompanyUser={isInsuranceCompanyUser}
          isFinance={isFinance}
          isFieldStaff={isFieldStaff}
          isOfficeStaff={isOfficeStaffRole(roleCode)}
        />
        <SessionTimeoutBar />
      </div>
      <ReactQueryDevtools initialIsOpen={false} />
      </NavigationGuardProvider>
      </PanelHelpDrawerProvider>
      </PanelUserProvider>
    </QueryClientProvider>
  );
}
