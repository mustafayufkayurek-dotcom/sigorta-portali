'use client';

import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState, useRef, useCallback } from 'react';
import { ToastProvider } from '@/contexts/ToastContext';
import AgreementConsentModal from '@/components/AgreementConsentModal';
import GlobalSearch from '@/components/GlobalSearch';
import SessionTimeoutBar from '@/components/SessionTimeoutBar';
import { TopProgressBar } from '@/components/ui/TopProgressBar';
import { GlobalActivityStrip } from '@/components/ui/GlobalActivityStrip';
import { RunningLightsText } from '@/components/ui/RunningLightsText';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { apiClient } from '@/lib/api-client';
import axios from 'axios';
import { CORPORATE_LOGO_LIGHT } from '@/constants/brand';
import type { LucideIcon } from 'lucide-react';
import {
  Bell,
  BookOpenText,
  Building2,
  ClipboardList,
  FileCog,
  FileText,
  GitBranch,
  Landmark,
  Layers3,
  Mail,
  MapPin,
  MessageSquareText,
  MonitorCheck,
  PackageCheck,
  Receipt,
  ScrollText,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  TestTube2,
  Users,
  UserCog,
  Wrench,
  WalletCards,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1').replace(/\/$/, '').replace(/\/api\/v1$/, '/api/v1');

// ── Rol Bazlı Erişim ──────────────────────────────────────────────────────────
type RoleCode = string;

interface RouteAccess {
  path: string;
  roles: RoleCode[];
}

const ROUTE_ACCESS: RouteAccess[] = [
  { path: '/panel', roles: [] },
  { path: '/panel/hasar-dosyalari', roles: ['admin', 'ADMIN', 'office_staff', 'OFFICE_STAFF', 'field_staff', 'FIELD_STAFF', 'FINANS', 'MANAGER'] },
  { path: '/panel/revizyon-talepleri', roles: ['admin', 'ADMIN', 'office_staff', 'OFFICE_STAFF', 'FINANS', 'MANAGER'] },
  { path: '/panel/sahiplik', roles: ['admin', 'ADMIN', 'MANAGER'] },
  { path: '/panel/personel-yonetimi', roles: ['admin', 'ADMIN', 'office_staff', 'OFFICE_STAFF', 'MANAGER'] },
  { path: '/panel/musteriler', roles: ['admin', 'ADMIN', 'office_staff', 'OFFICE_STAFF', 'FINANS', 'MANAGER'] },
  { path: '/panel/tedarikciler', roles: ['admin', 'ADMIN', 'office_staff', 'OFFICE_STAFF', 'FINANS', 'MANAGER'] },
  { path: '/panel/crm', roles: ['admin', 'ADMIN', 'office_staff', 'OFFICE_STAFF', 'FINANS', 'MANAGER'] },
  { path: '/panel/eksper-crm', roles: ['admin', 'ADMIN', 'office_staff', 'OFFICE_STAFF', 'FINANS', 'MANAGER'] },
  { path: '/panel/eksperler', roles: ['admin', 'ADMIN', 'office_staff', 'OFFICE_STAFF', 'FINANS', 'MANAGER'] },
  { path: '/panel/finans', roles: ['admin', 'ADMIN', 'accountant', 'ACCOUNTANT', 'FINANS', 'MANAGER'] },
  { path: '/panel/raporlar', roles: ['admin', 'ADMIN', 'accountant', 'ACCOUNTANT', 'FINANS', 'MANAGER'] },
  { path: '/panel/ayarlar', roles: ['admin', 'ADMIN'] },
  { path: '/panel/kullanicilar', roles: ['admin', 'ADMIN'] },
  { path: '/panel/guvenlik', roles: ['admin', 'ADMIN'] },
  { path: '/panel/harita', roles: ['admin', 'ADMIN', 'office_staff', 'OFFICE_STAFF', 'MANAGER'] },
  { path: '/panel/acil-yardim', roles: ['admin', 'ADMIN', 'office_staff', 'OFFICE_STAFF', 'MANAGER'] },
  { path: '/panel/operasyon', roles: ['admin', 'ADMIN', 'office_staff', 'OFFICE_STAFF', 'FINANS', 'MANAGER'] },
  { path: '/panel/carilerim', roles: ['field_staff', 'FIELD_STAFF', 'admin', 'ADMIN', 'FINANS', 'OFFICE_STAFF', 'office_staff', 'MANAGER'] },
];

function hasRouteAccess(pathname: string, roleCode: string): boolean {
  const matching = ROUTE_ACCESS
    .filter((r) => pathname === r.path || pathname.startsWith(r.path + '/'))
    .sort((a, b) => b.path.length - a.path.length);
  if (matching.length === 0) return true;
  const rule = matching[0];
  if (rule.roles.length === 0) return true;
  return rule.roles.includes(roleCode);
}

interface NavItemAccess {
  path: string;
  roles: RoleCode[];
}

const NAV_ITEM_ACCESS: NavItemAccess[] = [
  { path: '/panel/hasar-dosyalari', roles: ['admin', 'ADMIN', 'office_staff', 'OFFICE_STAFF', 'field_staff', 'FIELD_STAFF', 'FINANS', 'MANAGER'] },
  { path: '/panel/revizyon-talepleri', roles: ['admin', 'ADMIN', 'office_staff', 'OFFICE_STAFF', 'FINANS', 'MANAGER'] },
  { path: '/panel/sahiplik', roles: ['admin', 'ADMIN', 'MANAGER'] },
  { path: '/panel/personel-yonetimi', roles: ['admin', 'ADMIN', 'office_staff', 'OFFICE_STAFF', 'MANAGER'] },
  { path: '/panel/musteriler', roles: ['admin', 'ADMIN', 'office_staff', 'OFFICE_STAFF', 'FINANS', 'MANAGER'] },
  { path: '/panel/tedarikciler', roles: ['admin', 'ADMIN', 'office_staff', 'OFFICE_STAFF', 'FINANS', 'MANAGER'] },
  { path: '/panel/crm', roles: ['admin', 'ADMIN', 'office_staff', 'OFFICE_STAFF', 'FINANS', 'MANAGER'] },
  { path: '/panel/eksperler', roles: ['admin', 'ADMIN', 'office_staff', 'OFFICE_STAFF', 'FINANS', 'MANAGER'] },
  { path: '/panel/eksper-portal', roles: ['admin', 'ADMIN', 'office_staff', 'OFFICE_STAFF'] },
  { path: '/panel/sigorta-portal', roles: ['admin', 'ADMIN', 'office_staff', 'OFFICE_STAFF'] },
  { path: '/panel/finans', roles: ['admin', 'ADMIN', 'accountant', 'ACCOUNTANT', 'FINANS', 'MANAGER'] },
  { path: '/panel/raporlar', roles: ['admin', 'ADMIN', 'accountant', 'ACCOUNTANT', 'FINANS', 'MANAGER'] },
  { path: '/panel/ayarlar', roles: ['admin', 'ADMIN'] },
  { path: '/panel/kullanicilar', roles: ['admin', 'ADMIN'] },
  { path: '/panel/guvenlik', roles: ['admin', 'ADMIN'] },
  { path: '/panel/harita', roles: ['admin', 'ADMIN', 'office_staff', 'OFFICE_STAFF', 'MANAGER'] },
  { path: '/panel/acil-yardim', roles: ['admin', 'ADMIN', 'office_staff', 'OFFICE_STAFF', 'MANAGER'] },
  { path: '/panel/operasyon', roles: ['admin', 'ADMIN', 'office_staff', 'OFFICE_STAFF', 'FINANS', 'MANAGER'] },
  { path: '/panel/carilerim', roles: ['field_staff', 'FIELD_STAFF', 'admin', 'ADMIN', 'FINANS', 'OFFICE_STAFF', 'office_staff', 'MANAGER'] },
];

function canSeeNavItem(path: string, roleCode: string): boolean {
  const rule = NAV_ITEM_ACCESS.find((r) => path.startsWith(r.path));
  if (!rule) return true;
  if (rule.roles.length === 0) return true;
  return rule.roles.includes(roleCode);
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
  eksperler:         '/panel/eksperler',
  musteriler:        '/panel/musteriler',
  tedarikciler:      '/panel/tedarikciler',
  raporlar:          '/panel/raporlar',
  ayarlar:           '/panel/ayarlar',
  kullanicilar:      '/panel/kullanicilar',
  guvenlik:          '/panel/guvenlik',
  harita:            '/panel/harita',
  personel_yonetimi: '/panel/personel-yonetimi',
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
  return allowedScreens.includes(match[0]);
}

const CONTEXT_BACK_LINKS: Record<string, { href: string; label: string }> = {
  '/panel/admin/audit-logs': { href: '/panel/guvenlik', label: 'Güvenlik sayfasına dön' },
  '/panel/finans/banka-hesaplari': { href: '/panel/finans', label: 'Finans sayfasına dön' },
  '/panel/finans/dosya-pl': { href: '/panel/finans', label: 'Finans sayfasına dön' },
  '/panel/finans/fatura-talepleri': { href: '/panel/finans', label: 'Finans sayfasına dön' },
  '/panel/finans/karlilik': { href: '/panel/finans', label: 'Finans sayfasına dön' },
  '/panel/finans/masraflar': { href: '/panel/finans', label: 'Finans sayfasına dön' },
  '/panel/finans/portfolyo-pl': { href: '/panel/finans', label: 'Finans sayfasına dön' },
  '/panel/finans/sabit-giderler': { href: '/panel/finans', label: 'Finans sayfasına dön' },
  '/panel/guvenlik/erisim-loglari': { href: '/panel/guvenlik', label: 'Güvenlik sayfasına dön' },
  '/panel/itirazlar': { href: '/panel/operasyon', label: 'Operasyon sayfasına dön' },
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
}

interface NavigationGroup {
  title: string;
  links: NavigationLink[];
  icon: LucideIcon;
}

const SETTINGS_NAV_GROUPS: NavigationGroup[] = [
  {
    title: 'Kullanıcı ve Yetki',
    icon: UserCog,
    links: [
      { title: 'Kullanıcılar', href: '/panel/kullanicilar', icon: Users },
      { title: 'Roller', href: '/panel/ayarlar/roller', icon: ShieldCheck },
    ],
  },
  {
    title: 'Kurumsal Ayarlar',
    icon: Settings,
    links: [
      { title: 'Alan Zorunlulukları', href: '/panel/ayarlar/alan-zorunluluklari', icon: SlidersHorizontal },
      { title: 'Mail ve Bildirim Merkezi', href: '/panel/ayarlar/e-posta-bildirimleri', icon: Mail },
      { title: 'Şablonlar', href: '/panel/ayarlar/sablonlar', icon: FileCog },
      { title: 'Sözleşmeler', href: '/panel/ayarlar/sozlesmeler', icon: ScrollText },
    ],
  },
  {
    title: 'Zorunlu Tanımlar',
    icon: BookOpenText,
    links: [
      {
        title: 'Tanımlar Merkezi',
        href: '/panel/ayarlar/tanimlar',
        icon: BookOpenText,
        children: [
          { title: 'Sigorta Şirketleri', href: '/panel/ayarlar/sigorta-sirketleri', icon: Building2 },
          { title: 'Tedarikçi Tanımları', href: '/panel/ayarlar/tedarikciler', icon: Users },
          { title: 'Müşteri Tipleri', href: '/panel/ayarlar/musteri-tipleri', icon: Users },
          { title: 'Departmanlar', href: '/panel/ayarlar/departmanlar', icon: Building2 },
          { title: 'İlişki Türleri', href: '/panel/ayarlar/iliski-turleri', icon: GitBranch },
        ],
      },
      { title: 'İhbar Konuları', href: '/panel/ayarlar/ihbar-konulari', icon: MessageSquareText },
      { title: 'Evrak Türleri', href: '/panel/ayarlar/evrak-turleri', icon: FileText },
      { title: 'Hizmet Türleri', href: '/panel/ayarlar/hizmet-turleri', icon: Wrench },
      { title: 'Mahal & Bölgeler', href: '/panel/ayarlar/mahaller', icon: MapPin },
    ],
  },
  {
    title: 'Operasyon Tanımları',
    icon: Layers3,
    links: [
      { title: 'Durumlar', href: '/panel/ayarlar/durumlar', icon: GitBranch },
      { title: 'Tedarikçi Branşları', href: '/panel/ayarlar/hizmet-branslari', icon: PackageCheck },
      { title: 'İş Grupları', href: '/panel/ayarlar/is-gruplari', icon: Layers3 },
    ],
  },
  {
    title: 'Finans ve Fiyatlandırma',
    icon: Receipt,
    links: [
      { title: 'Fiyat Listesi', href: '/panel/ayarlar/fiyat-listesi', icon: Receipt },
      { title: 'Masraf Kategorileri', href: '/panel/ayarlar/masraf-kategorileri', icon: WalletCards },
      { title: 'Bölgesel Zamlar', href: '/panel/ayarlar/bolgesel-zamlar', icon: Landmark },
    ],
  },
  {
    title: 'Yönetim ve Denetim',
    icon: TestTube2,
    links: [
      { title: 'Pilot Notları', href: '/panel/ayarlar/test-notlari-gorev-takip', icon: TestTube2 },
    ],
  },
];

function getPanelMainLinks({
  isExpert,
  isInsuranceCompanyUser,
  pendingRevisionCount,
}: {
  isExpert: boolean;
  isInsuranceCompanyUser: boolean;
  pendingRevisionCount: number;
}): NavigationLink[] {
  return isExpert
    ? [
        { title: 'Eksper Paneli', href: '/panel/eksper-portal', icon: Users },
        { title: 'Bekleyen Onaylar', href: '/panel/eksper-portal/onaylar', icon: ShieldCheck },
        { title: 'Atanmış Dosyalar', href: '/panel/eksper-portal/dosyalar', icon: ClipboardList },
        { title: 'Randevular', href: '/panel/eksper-portal/randevular', icon: Bell },
      ]
    : isInsuranceCompanyUser
      ? [
          { title: 'Sigorta Paneli', href: '/panel/sigorta-portal', icon: Building2 },
          { title: 'Bekleyen Onaylar', href: '/panel/sigorta-portal/onaylar', icon: ShieldCheck },
          { title: 'Dosyalar', href: '/panel/sigorta-portal/dosyalar', icon: ClipboardList },
        ]
      : [
          { title: 'Dashboard', href: '/panel', icon: MonitorCheck },
          { title: 'Operasyon', href: '/panel/operasyon', alertCount: pendingRevisionCount, icon: ClipboardList },
          { title: 'Personel', href: '/panel/personel-yonetimi', icon: UserCog },
          { title: 'Kullanıcılar', href: '/panel/kullanicilar', icon: Users },
          { title: 'Sahiplik', href: '/panel/sahiplik', icon: ShieldCheck },
          { title: 'Müşteriler', href: '/panel/musteriler', icon: Users },
          { title: 'Tedarikçiler', href: '/panel/tedarikciler', icon: PackageCheck },
          { title: 'CRM', href: '/panel/crm', icon: GitBranch },
          { title: 'Finans', href: '/panel/finans', icon: Receipt },
          { title: 'Harita', href: '/panel/harita', icon: MapPin },
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
}

function Navbar({
  user, roleCode, isPortalUser, isExpert, isInsuranceCompanyUser,
  pendingRevisionCount, onLogout,
  unreadCount, notifOpen, onNotifOpen, onNotifClose, notifications, onMarkAllRead,
  onNotifClick, relativeTime, notifTypeColor, notifTypeBorder, notifTypeIcon,
  allowedScreens, companyLogo, companyName,
}: NavbarProps & { companyLogo: string | null; companyName: string }) {
  // Yetki kontrolü: DB izinleri varsa öncelikli, yoksa role-default
  const canSee = (path: string) =>
    allowedScreens !== null
      ? canSeeNavItemDynamic(path, allowedScreens, roleCode)
      : canSeeNavItem(path, roleCode);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropOpen, setProfileDropOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileDropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsHydrated(true);
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
      if (notifRef.current && !notifRef.current.contains(target)) onNotifClose();
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [onNotifClose]);

  const mainLinks = getPanelMainLinks({ isExpert, isInsuranceCompanyUser, pendingRevisionCount });
  const visibleMainLinks = isPortalUser ? mainLinks : mainLinks.filter((link) => canSee(link.href));

  const displayLogo = companyLogo || CORPORATE_LOGO_LIGHT;
  const logoContent = (
    <img
      src={displayLogo}
      alt={companyName}
      className="block max-h-[52px] w-auto max-w-[220px] object-contain object-left"
      onError={(e) => {
        if (e.currentTarget.src !== CORPORATE_LOGO_LIGHT) {
          e.currentTarget.src = CORPORATE_LOGO_LIGHT;
        }
      }}
    />
  );

  return (
    <header className="bg-white border-b border-slate-200/80 sticky top-0 z-50 shadow-navbar dark:bg-slate-950 dark:text-slate-100 dark:border-slate-800">
      <div className="mx-auto max-w-screen-2xl px-4">
        <div className="flex h-[72px] items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-5 min-w-0">
            <a
              href="https://meridyenassistance.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-14 min-w-[176px] shrink-0 items-center justify-center gap-2.5 overflow-hidden rounded-xl border border-slate-200 bg-white px-3 shadow-md transition hover:border-blue-200 dark:border-slate-700 dark:bg-slate-100"
              title="Meridyen Assistance web sitesini yeni sekmede aç"
            >
              {logoContent}
            </a>

          </div>

          {/* Right side */}
          <div className="flex items-center gap-1.5">

            {/* Arama Butonu */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="hidden md:flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition-all text-sm"
              title="Ara (Ctrl+K)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="text-xs text-slate-400">Ara...</span>
              <kbd className="hidden lg:flex items-center gap-0.5 ml-1 px-1 py-0.5 text-[9px] font-medium text-slate-300 bg-slate-100 rounded border border-slate-200">
                ⌘K
              </kbd>
            </button>

            {/* Mobil arama ikonu */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="md:hidden flex items-center justify-center w-9 h-9 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              title="Ara"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>

            {/* Global Search Modal */}
            <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />

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
                  <span className="absolute top-0.5 right-0.5 flex items-center justify-center min-w-[16px] h-4 px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <>
                  <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-2xl shadow-xl border border-slate-100/80 z-50 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/80">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-800">Bildirimler</span>
                        {unreadCount > 0 && (
                          <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                            {unreadCount > 99 ? '99+' : unreadCount}
                          </span>
                        )}
                      </div>
                      {unreadCount > 0 && (
                        <button type="button" onClick={onMarkAllRead} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
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
                      <Link href="/panel/bildirimler" className="text-xs text-blue-600 hover:text-blue-700 font-medium" onClick={() => onNotifOpen()}>
                        Tüm Bildirimleri Gör
                      </Link>
                      <span className="text-[10px] text-slate-400">{notifications.length} bildirim</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Profil Dropdown */}
            <div className="relative" ref={profileDropRef}>
              <button
                type="button"
                onClick={() => setProfileDropOpen((v) => !v)}
                className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm shadow-blue-200">
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </div>
                <span className="hidden sm:block text-sm font-medium text-slate-700 max-w-[120px] truncate">
                  {user?.firstName} {user?.lastName}
                </span>
                <svg className="hidden sm:block w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {profileDropOpen && (
                <>
                  <div className="absolute right-0 top-full mt-1.5 w-52 bg-white rounded-2xl shadow-xl border border-slate-100/80 py-1.5 z-50">
                    <div className="px-4 py-2.5 border-b border-slate-100">
                      <p className="text-sm font-semibold text-slate-800 truncate">{user?.firstName} {user?.lastName}</p>
                      <p className="text-xs text-slate-400 truncate">{user?.role?.name ?? roleCode}</p>
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

            {/* Mobil hamburger */}
            <button
              type="button"
              className="md:hidden flex items-center justify-center w-9 h-9 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors"
              onClick={() => setMobileMenuOpen((v) => !v)}
            >
              {mobileMenuOpen ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobil menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-100 py-3 space-y-0.5">
            {visibleMainLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center justify-between gap-2 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-blue-50/60 hover:text-blue-700 rounded-lg transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                <span className="inline-flex min-w-0 items-center gap-2">
                  {link.icon ? <link.icon className="h-4 w-4 shrink-0 text-slate-400" /> : null}
                  <span className="truncate">{link.title}</span>
                </span>
                {link.alertCount && link.alertCount > 0 ? (
                  <span className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {link.alertCount > 99 ? '99+' : link.alertCount}
                  </span>
                ) : null}
              </Link>
            ))}
            <div className="border-t border-slate-100 pt-2 mt-2">
              <button type="button"
                onClick={() => { setMobileMenuOpen(false); onLogout(); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                Çıkış Yap
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

interface PanelSidebarProps {
  pathname: string;
  roleCode: string;
  isPortalUser: boolean;
  isExpert: boolean;
  isInsuranceCompanyUser: boolean;
  pendingRevisionCount: number;
  allowedScreens: string[] | null;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  hidden?: boolean;
}

function isSettingsPath(pathname: string) {
  return (
    pathname === '/panel/ayarlar' ||
    pathname.startsWith('/panel/ayarlar/') ||
    pathname === '/panel/kullanicilar' ||
    pathname.startsWith('/panel/kullanicilar/')
  );
}

function PanelSidebar({
  pathname,
  roleCode,
  isPortalUser,
  isExpert,
  isInsuranceCompanyUser,
  pendingRevisionCount,
  allowedScreens,
  collapsed,
  onToggleCollapsed,
  hidden = false,
}: PanelSidebarProps) {
  if (hidden) return null;

  const canSee = (path: string) =>
    allowedScreens !== null
      ? canSeeNavItemDynamic(path, allowedScreens, roleCode)
      : canSeeNavItem(path, roleCode);

  const isActive = (href: string) => {
    const normalizedHref = href.split('?')[0];
    return normalizedHref === '/panel'
      ? pathname === '/panel'
      : pathname === normalizedHref || pathname.startsWith(normalizedHref + '/');
  };

  const isSettingsActive = isSettingsPath(pathname);
  const [openSettingsGroups, setOpenSettingsGroups] = useState<string[]>(() => SETTINGS_NAV_GROUPS.map((group) => group.title));

  useEffect(() => {
    if (collapsed) {
      setOpenSettingsGroups([]);
    }
  }, [collapsed]);

  const mainLinks = getPanelMainLinks({ isExpert, isInsuranceCompanyUser, pendingRevisionCount });

  const visibleMainLinks = isPortalUser ? mainLinks : mainLinks.filter((link) => canSee(link.href));
  const hasActiveChild = (link: NavigationLink) => Boolean(link.children?.some((child) => isActive(child.href)));

  const linkClass = (href: string, compact = false, forceActive?: boolean) => {
    const active = forceActive ?? isActive(href);
    return `group flex items-center justify-between gap-2 rounded-lg px-3 ${compact ? 'py-1.5 text-xs' : 'py-2 text-sm'} font-semibold transition ${
      active
        ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-100'
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
    }`;
  };

  return (
    <aside
      className={`hidden shrink-0 border-r border-slate-200 bg-white transition-[width] duration-200 md:block dark:border-slate-800 dark:bg-slate-950 ${
        collapsed ? 'w-[74px]' : 'w-[286px]'
      }`}
    >
      <div className="sticky top-[73px] h-[calc(100vh-73px)] overflow-y-auto px-3 py-4">
        <div className={`mb-3 flex items-center ${collapsed ? 'justify-center px-0' : 'justify-between px-3'}`}>
          {!collapsed ? (
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Menü</p>
          ) : null}
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:border-slate-700 dark:hover:bg-slate-800"
            aria-label={collapsed ? 'Menüyü genişlet' : 'Menüyü daralt'}
            title={collapsed ? 'Menüyü genişlet' : 'Menüyü daralt'}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        <nav className="space-y-1">
          {visibleMainLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={linkClass(link.href, false, link.href === '/panel/kullanicilar' ? isSettingsActive : undefined)}
              title={collapsed ? link.title : undefined}
            >
              <span className={`inline-flex min-w-0 items-center ${collapsed ? 'justify-center w-full' : 'gap-2'}`}>
                {link.icon ? <link.icon className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:text-slate-600" /> : null}
                {!collapsed ? <span className="truncate">{link.title}</span> : null}
              </span>
              {!collapsed && link.alertCount && link.alertCount > 0 ? (
                <span className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {link.alertCount > 99 ? '99+' : link.alertCount}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>

        {canSee('/panel/ayarlar') && isSettingsActive && !collapsed && (
          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/80 p-2 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="mt-3 space-y-3">
              {SETTINGS_NAV_GROUPS.map((group) => (
                <section key={group.title}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenSettingsGroups((current) =>
                        current.includes(group.title)
                          ? current.filter((title) => title !== group.title)
                          : [...current, group.title],
                      );
                    }}
                    className="flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 transition hover:bg-white hover:text-slate-600 dark:hover:bg-slate-800"
                    aria-expanded={openSettingsGroups.includes(group.title)}
                  >
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      <group.icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{group.title}</span>
                    </span>
                    <span className="text-[11px]">{openSettingsGroups.includes(group.title) ? '−' : '+'}</span>
                  </button>
                  {openSettingsGroups.includes(group.title) && (
                    <div className="mt-1 space-y-0.5">
                      {group.links.map((link) => (
                        <div key={link.href}>
                          <Link href={link.href} className={linkClass(link.href, true)}>
                            <span className="inline-flex min-w-0 items-center gap-1.5">
                              {link.icon ? <link.icon className="h-3.5 w-3.5 shrink-0 text-slate-400" /> : null}
                              <span className="truncate">{link.title}</span>
                            </span>
                            {link.children ? (
                              <span className="text-[11px] text-slate-400">{hasActiveChild(link) || isActive(link.href) ? '−' : '+'}</span>
                            ) : null}
                          </Link>
                          {link.children && (hasActiveChild(link) || isActive(link.href)) && (
                            <div className="ml-4 mt-0.5 space-y-0.5 border-l border-slate-200 pl-2 dark:border-slate-700">
                              {link.children.map((child) => (
                                <Link key={child.href} href={child.href} className={linkClass(child.href, true)}>
                                  <span className="inline-flex min-w-0 items-center gap-1.5">
                                    {child.icon ? <child.icon className="h-3.5 w-3.5 shrink-0 text-slate-400" /> : null}
                                    <span className="truncate">{child.title}</span>
                                  </span>
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              ))}
            </div>
          </div>
        )}
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
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingRevisionCount, setPendingRevisionCount] = useState(0);
  const [pendingAgreements, setPendingAgreements] = useState<PendingAgreement[]>([]);
  const [agreementsChecked, setAgreementsChecked] = useState(false);
  const [allowedScreens, setAllowedScreens] = useState<string[] | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Tema localStorage'dan oku — SSR safe + canlı güncelleme
  useEffect(() => {
    const applyTheme = () => {
      try {
        const html = document.documentElement;
        const saved = localStorage.getItem('app-theme');
        let shouldUseDark = false;
        if (saved) {
          const { mode, colorScheme } = JSON.parse(saved) as { mode?: string; colorScheme?: string };
          const media = window.matchMedia('(prefers-color-scheme: dark)');
          shouldUseDark = mode === 'dark' || (mode === 'system' && media.matches);
          if (colorScheme) {
            html.setAttribute('data-color-scheme', colorScheme);
          }
        } else {
          html.setAttribute('data-color-scheme', 'blue');
        }
        html.classList.toggle('dark', shouldUseDark);
        html.style.colorScheme = shouldUseDark ? 'dark' : 'light';
      } catch { /* localStorage erişim hatası yoksay */ }
    };
    applyTheme();
    // Kurulum sayfasından tema değişince anında uygula
    const onStorage = (e: StorageEvent) => { if (e.key === 'app-theme') applyTheme(); };
    const onCustom = () => applyTheme();
    window.addEventListener('storage', onStorage);
    window.addEventListener('theme-changed', onCustom);
    return () => {
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
    const clearAuth = () => {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      localStorage.removeItem('authPersistence');
      localStorage.removeItem('tokenExpiry');
      sessionStorage.removeItem('accessToken');
      sessionStorage.removeItem('refreshToken');
      sessionStorage.removeItem('authSession');
    };

    const hasValidSessionScope = () => {
      const persistence = localStorage.getItem('authPersistence');
      const sessionActive = sessionStorage.getItem('authSession') === 'active';
      return persistence === 'remember' || sessionActive;
    };

    const persistTokens = (accessToken: string, refreshToken: string) => {
      const persistence = localStorage.getItem('authPersistence');
      if (persistence === 'remember') {
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        return;
      }
      sessionStorage.setItem('accessToken', accessToken);
      sessionStorage.setItem('refreshToken', refreshToken);
      sessionStorage.setItem('authSession', 'active');
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('authPersistence', 'session');
    };

    const token = localStorage.getItem('accessToken');
    if (!token || !hasValidSessionScope()) {
      clearAuth();
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
        } else {
          throw new Error('auth/me boş döndü');
        }
        return axios.get(`${apiBase}/users/me/permissions`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      })
      .then((response) => {
        const data = response.data?.data ?? response.data;
        if (data?.screens) setAllowedScreens(data.screens);
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
          const refreshToken = localStorage.getItem('refreshToken');
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
                  const permissions = await axios.get(`${apiBase}/users/me/permissions`, {
                    headers: { Authorization: `Bearer ${tokens.accessToken}` },
                  });
                  const permData = permissions.data?.data ?? permissions.data;
                  if (permData?.screens) setAllowedScreens(permData.screens);
                  return;
                }
              }
            } catch {}
          }
        }
        clearAuth();
        router.push('/giris');
      })
      .finally(() => {
        setLoading(false);
        setAuthChecked(true);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Onaylanmamış sözleşme kontrolü
  useEffect(() => {
    if (loading || !authChecked) return;
    if (!localStorage.getItem('accessToken')) return;
    apiClient.get<any[]>('/agreements/pending')
      .then((data) => {
        if (data) setPendingAgreements(data);
      })
      .catch(() => {})
      .finally(() => setAgreementsChecked(true));
  }, [loading]);

  const fetchUnreadCount = useCallback(async () => {
    try {
      if (!localStorage.getItem('accessToken')) return;
      const data = await apiClient.get<{ count?: number }>('/notifications/unread-count');
      setUnreadCount(data?.count ?? 0);
    } catch {}
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      if (!localStorage.getItem('accessToken')) return;
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
    if (!loading && authChecked) {
      if (!localStorage.getItem('accessToken')) return;
      apiClient.getWithMeta<any[], { total?: number }>('/revision-requests', { status: 'REQUESTED', limit: 1 })
        .then((json) => { if (json) setPendingRevisionCount(json?.meta?.total ?? json?.data?.length ?? 0); })
        .catch(() => { setPendingRevisionCount(0); });
    }
  }, [loading]);

  const handleNotifOpen = async () => {
    const newOpen = !notifOpen;
    setNotifOpen(newOpen);
    if (newOpen) await fetchNotifications();
  };

  const handleMarkRead = async (notifId: string) => {
    try {
      if (!localStorage.getItem('accessToken')) return;
      await apiClient.patch(`/notifications/${notifId}/read`);
      setNotifications((prev) => prev.map((n) => (n.id === notifId ? { ...n, status: 'read' } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {}
  };

  const handleMarkAllRead = async () => {
    try {
      if (!localStorage.getItem('accessToken')) return;
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
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    sessionStorage.clear();
    router.push('/giris');
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
    if (type === 'overdue' || type === 'sla_violation') return 'border-l-4 border-red-500';
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
  const isExpert = roleCode === 'expert';
  const isInsuranceCompanyUser = roleCode === 'insurance_company_user';
  const isPortalUser = isExpert || isInsuranceCompanyUser;

  useEffect(() => {
    if (!loading && isExpert && pathname === '/panel') router.replace('/panel/eksper-portal');
    if (!loading && isInsuranceCompanyUser && pathname === '/panel') router.replace('/panel/sigorta-portal');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, roleCode]);

  useEffect(() => {
    if (!loading && user?.mustChangePassword && pathname !== '/panel/profil') {
      router.replace('/panel/profil');
    }
  }, [loading, user?.mustChangePassword, pathname, router]);

  const isPublicPanelPath = pathname === '/panel/profil';
  const mustChangePassword = user?.mustChangePassword === true;
  const accessDenied =
    !loading && !isPortalUser && !isPublicPanelPath && !mustChangePassword && roleCode !== '' && !hasRouteAccess(pathname, roleCode);

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

  const navbarProps = {
    user, pathname, roleCode, isPortalUser, isExpert, isInsuranceCompanyUser,
    pendingRevisionCount, onLogout: handleLogout,
    unreadCount, notifOpen, onNotifOpen: handleNotifOpen,
    onNotifClose: () => setNotifOpen(false),
    notifications, onMarkRead: handleMarkRead, onMarkAllRead: handleMarkAllRead,
    onNotifClick: handleNotifClick, relativeTime, notifTypeColor, notifTypeBorder, notifTypeIcon,
    allowedScreens, companyLogo, companyName,
  };
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

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <RunningLightsText text="Oturum hazırlanıyor" size="lg" variant="emerald" />
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
              <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m0 0v2m0-2h2m-2 0H10m2-11a2 2 0 00-2 2v6a2 2 0 004 0V8a2 2 0 00-2-2zm-7 9a9 9 0 1118 0 9 9 0 01-18 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Erişim Yetkiniz Yok</h2>
            <p className="text-slate-500 text-sm mb-6">Bu sayfayı görüntülemek için gerekli yetkiye sahip değilsiniz.</p>
            <div className="flex gap-3 justify-center">
              <Link href="/panel" className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 shadow-sm shadow-blue-200/60">Dashboard&apos;a Dön</Link>
              <button type="button" onClick={() => router.back()} className="px-5 py-2.5 bg-white text-slate-700 border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50 shadow-sm">Geri Git</button>
            </div>
            <p className="mt-4 text-xs text-slate-400">Hata kodu: 403 — Rol: {user?.role?.name ?? roleCode}</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-slate-50 flex flex-col" ref={mainRef}>
        <Navbar {...navbarProps} />
        <div className="flex min-h-0 flex-1">
          <PanelSidebar
            pathname={pathname}
            roleCode={roleCode}
            isPortalUser={isPortalUser}
            isExpert={isExpert}
            isInsuranceCompanyUser={isInsuranceCompanyUser}
            pendingRevisionCount={pendingRevisionCount}
            allowedScreens={allowedScreens}
            collapsed={sidebarCollapsed}
            onToggleCollapsed={toggleSidebarCollapsed}
            hidden={mustChangePassword}
          />
          <div className="min-w-0 flex-1">
        {agreementsChecked && pendingAgreements.length > 0 && (
          <AgreementConsentModal
            pendingAgreements={pendingAgreements}
            onAllAccepted={() => setPendingAgreements([])}
          />
        )}
        <main className="flex-1">
          <div className="mx-auto max-w-screen-2xl px-4 py-6">
            <TopProgressBar />
            <GlobalActivityStrip />
            {contextBackLink && (
              <Link
                href={contextBackLink.href}
                className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              >
                <span aria-hidden="true">←</span>
                {contextBackLink.label}
              </Link>
            )}
            <ToastProvider>{children}</ToastProvider>
          </div>
        </main>
          </div>
        </div>
        <SessionTimeoutBar />
      </div>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
