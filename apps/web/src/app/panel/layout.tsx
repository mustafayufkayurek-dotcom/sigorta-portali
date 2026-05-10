'use client';

import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState, useRef, useCallback } from 'react';
import { ToastProvider } from '@/contexts/ToastContext';
import AgreementConsentModal from '@/components/AgreementConsentModal';
import GlobalSearch from '@/components/GlobalSearch';
import SessionTimeoutBar from '@/components/SessionTimeoutBar';
import { TopProgressBar } from '@/components/ui/TopProgressBar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

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

const _layoutApiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
const API_BASE = _layoutApiBase.endsWith('/api/v1') ? _layoutApiBase.replace(/\/api\/v1$/, '') : _layoutApiBase;

// Ekran kodu → path eşlemesi (DB izin sistemi için)
const SCREEN_TO_PATH: Record<string, string> = {
  hasar_dosyalari:   '/panel/hasar-dosyalari',
  acil_yardim:       '/panel/acil-yardim',
  finans:            '/panel/finans',
  operasyon:         '/panel/operasyon',
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

function canSeeNavItemDynamic(navPath: string, allowedScreens: string[]): boolean {
  const match = Object.entries(SCREEN_TO_PATH).find(([, p]) => navPath.startsWith(p));
  if (!match) return true;
  return allowedScreens.includes(match[0]);
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
  user, pathname, roleCode, isPortalUser, isExpert, isInsuranceCompanyUser,
  pendingRevisionCount, onLogout,
  unreadCount, notifOpen, onNotifOpen, onNotifClose, notifications, onMarkAllRead,
  onNotifClick, relativeTime, notifTypeColor, notifTypeBorder, notifTypeIcon,
  allowedScreens,
}: NavbarProps) {
  // Yetki kontrolü: DB izinleri varsa öncelikli, yoksa role-default
  const canSee = (path: string) =>
    allowedScreens !== null
      ? canSeeNavItemDynamic(path, allowedScreens)
      : canSeeNavItem(path, roleCode);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [yonetimDropOpen, setYonetimDropOpen] = useState(false);
  const [settingsDropOpen, setSettingsDropOpen] = useState(false);
  const [profileDropOpen, setProfileDropOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const yonetimDropRef = useRef<HTMLDivElement>(null);
  const settingsDropRef = useRef<HTMLDivElement>(null);
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
      if (yonetimDropRef.current && !yonetimDropRef.current.contains(target)) setYonetimDropOpen(false);
      if (settingsDropRef.current && !settingsDropRef.current.contains(target)) setSettingsDropOpen(false);
      if (profileDropRef.current && !profileDropRef.current.contains(target)) setProfileDropOpen(false);
      if (notifRef.current && !notifRef.current.contains(target)) onNotifClose();
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [onNotifClose]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  const navLinkCls = (href: string) =>
    `text-xs lg:text-sm font-medium transition-all px-2 md:px-2 lg:px-2.5 py-1.5 rounded-lg whitespace-nowrap ${
      isActive(href)
        ? 'text-blue-700 bg-blue-50 font-semibold'
        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
    }`;

  return (
    <header className="bg-white border-b border-slate-200/80 sticky top-0 z-50 shadow-navbar">
      <div className="mx-auto max-w-screen-2xl px-4">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <div className="flex items-center gap-5 min-w-0">
            <Link href="/panel" className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm shadow-blue-200">
                <svg className="w-4.5 h-4.5 text-white" width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-slate-900 text-[14px] font-extrabold tracking-tight">Meridyen</span>
                <span className="text-slate-400 text-[10px] font-medium tracking-wider uppercase">Assistance</span>
              </div>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-0.5 lg:gap-1 overflow-x-auto overscroll-x-contain scrollbar-hide max-w-[min(100vw-20rem,56rem)] lg:max-w-none">
              {isExpert && (
                <>
                  <Link href="/panel/eksper-portal" className={navLinkCls('/panel/eksper-portal')}>Dashboard</Link>
                  <Link href="/panel/eksper-portal/onaylar" className={navLinkCls('/panel/eksper-portal/onaylar')}>Bekleyen Onaylar</Link>
                  <Link href="/panel/eksper-portal/dosyalar" className={navLinkCls('/panel/eksper-portal/dosyalar')}>Atanmış Dosyalar</Link>
                  <Link href="/panel/eksper-portal/randevular" className={navLinkCls('/panel/eksper-portal/randevular')}>Randevular</Link>
                </>
              )}
              {isInsuranceCompanyUser && (
                <>
                  <Link href="/panel/sigorta-portal" className={navLinkCls('/panel/sigorta-portal')}>Dashboard</Link>
                  <Link href="/panel/sigorta-portal/onaylar" className={navLinkCls('/panel/sigorta-portal/onaylar')}>Bekleyen Onaylar</Link>
                  <Link href="/panel/sigorta-portal/dosyalar" className={navLinkCls('/panel/sigorta-portal/dosyalar')}>Dosyalar</Link>
                </>
              )}
              {!isPortalUser && (
                <>
                  <Link href="/panel" className={`text-sm font-medium transition-all px-2.5 py-1.5 rounded-lg ${pathname === '/panel' ? 'text-blue-700 bg-blue-50 font-semibold' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}>Dashboard</Link>
                  {canSee('/panel/hasar-dosyalari') && (
                    <Link href="/panel/operasyon" className={`text-xs lg:text-sm font-medium transition-all px-2 md:px-2 lg:px-2.5 py-1.5 rounded-lg whitespace-nowrap flex items-center gap-1 md:gap-1 lg:gap-1.5 ${
                      isActive('/panel/operasyon') || isActive('/panel/hasar-dosyalari') || isActive('/panel/acil-yardim')
                        ? 'text-blue-700 bg-blue-50 font-semibold' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                    }`}>
                      Operasyon
                      {pendingRevisionCount > 0 && (
                        <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold">
                          {pendingRevisionCount > 99 ? '99+' : pendingRevisionCount}
                        </span>
                      )}
                    </Link>
                  )}
                  {canSee('/panel/personel-yonetimi') && (
                    <Link href="/panel/personel-yonetimi" className={navLinkCls('/panel/personel-yonetimi')}>Personel</Link>
                  )}
                  {canSee('/panel/sahiplik') && (
                    <Link href="/panel/sahiplik" className={navLinkCls('/panel/sahiplik')}>Sahiplik</Link>
                  )}

                  {/* Müşteriler — düz link */}
                  {canSee('/panel/musteriler') && (
                    <Link href="/panel/musteriler" className={navLinkCls('/panel/musteriler')}>Müşteriler</Link>
                  )}

                  {/* Tedarikçiler — bağımsız link */}
                  {canSee('/panel/tedarikciler') && (
                    <Link href="/panel/tedarikciler" className={navLinkCls('/panel/tedarikciler')}>Tedarikçiler</Link>
                  )}

                  {/* Portal Dropdown (Kaldırıldı — İçerikler portal kullanıcılarına özel) */}

                  {/* Finans Dropdown (eski adı: Yönetim) */}
                  {canSee('/panel/finans') && (
                    <div className="relative z-[60]" ref={yonetimDropRef}>
                      <button type="button" onClick={() => { setYonetimDropOpen((v) => !v); setSettingsDropOpen(false); }} className={`text-xs lg:text-sm font-medium transition-all px-2 md:px-2 lg:px-2.5 py-1.5 rounded-lg whitespace-nowrap flex items-center gap-1 md:gap-1 lg:gap-1.5 ${
                        pathname.startsWith('/panel/finans') || pathname.startsWith('/panel/raporlar') || pathname.startsWith('/panel/carilerim')
                          ? 'text-blue-700 bg-blue-50 font-semibold' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                      }`} aria-expanded={yonetimDropOpen}>
                        Finans
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </button>
                      {yonetimDropOpen && (
                        <div className="absolute top-full left-0 mt-1.5 w-52 bg-white rounded-2xl shadow-xl border border-slate-100/80 py-1.5 z-[70]">
                          <p className="px-4 pt-2 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Finans</p>
                          <Link href="/panel/finans" className="block mx-1 px-3 py-2 text-sm text-slate-700 hover:bg-blue-50/60 hover:text-blue-700 rounded-lg transition-colors" onClick={() => setYonetimDropOpen(false)}>Finans Özeti</Link>
                          <Link href="/panel/finans/fatura-talepleri" className="block mx-1 px-3 py-2 text-sm text-slate-700 hover:bg-blue-50/60 hover:text-blue-700 rounded-lg transition-colors" onClick={() => setYonetimDropOpen(false)}>Fatura Talepleri</Link>
                          <Link href="/panel/finans/faturalar" className="block mx-1 px-3 py-2 text-sm text-slate-700 hover:bg-blue-50/60 hover:text-blue-700 rounded-lg transition-colors" onClick={() => setYonetimDropOpen(false)}>Faturalar</Link>
                          <Link href="/panel/finans/tahsilatlar" className="block mx-1 px-3 py-2 text-sm text-slate-700 hover:bg-blue-50/60 hover:text-blue-700 rounded-lg transition-colors" onClick={() => setYonetimDropOpen(false)}>Tahsilatlar ve Ödemeler</Link>
                          <Link href="/panel/finans/karlilik" className="block mx-1 px-3 py-2 text-sm text-slate-700 hover:bg-blue-50/60 hover:text-blue-700 rounded-lg transition-colors" onClick={() => setYonetimDropOpen(false)}>Kârlılık Analizi</Link>
                          <Link href="/panel/finans/dosya-pl" className="block mx-1 px-3 py-2 text-sm text-slate-700 hover:bg-blue-50/60 hover:text-blue-700 rounded-lg transition-colors" onClick={() => setYonetimDropOpen(false)}>Portföy P&amp;L</Link>
                          <Link href="/panel/finans/sabit-giderler" className="block mx-1 px-3 py-2 text-sm text-slate-700 hover:bg-blue-50/60 hover:text-blue-700 rounded-lg transition-colors" onClick={() => setYonetimDropOpen(false)}>Sabit Giderler</Link>
                          <Link href="/panel/finans/masraflar" className="block mx-1 px-3 py-2 text-sm text-slate-700 hover:bg-blue-50/60 hover:text-blue-700 rounded-lg transition-colors" onClick={() => setYonetimDropOpen(false)}>Masraflar</Link>
                          <div className="my-1.5 border-t border-slate-100" />
                          <p className="px-4 pt-1 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Raporlar</p>
                          <Link href="/panel/raporlar/dosya-performansi" className="block mx-1 px-3 py-2 text-sm text-slate-700 hover:bg-blue-50/60 hover:text-blue-700 rounded-lg transition-colors" onClick={() => setYonetimDropOpen(false)}>Dosya Performansı</Link>
                          <Link href="/panel/raporlar/finansal" className="block mx-1 px-3 py-2 text-sm text-slate-700 hover:bg-blue-50/60 hover:text-blue-700 rounded-lg transition-colors" onClick={() => setYonetimDropOpen(false)}>Finansal Rapor</Link>
                          <Link href="/panel/raporlar/sla" className="block mx-1 px-3 py-2 text-sm text-slate-700 hover:bg-blue-50/60 hover:text-blue-700 rounded-lg transition-colors" onClick={() => setYonetimDropOpen(false)}>SLA Raporu</Link>
                        </div>
                      )}
                    </div>
                  )}

                  {canSee('/panel/harita') && (
                    <Link href="/panel/harita" className={navLinkCls('/panel/harita')}>Harita</Link>
                  )}

                  {canSee('/panel/carilerim') && (
                    <Link href="/panel/carilerim" className={navLinkCls('/panel/carilerim')}>Carilerim</Link>
                  )}

                  {/* Ayarlar Dropdown */}
                  {canSee('/panel/ayarlar') && (
                    <div className="relative z-[60]" ref={settingsDropRef}>
                      <button type="button" onClick={() => { setSettingsDropOpen((v) => !v); setYonetimDropOpen(false); }} className={`text-xs lg:text-sm font-medium transition-all px-2 md:px-2 lg:px-2.5 py-1.5 rounded-lg whitespace-nowrap flex items-center gap-1 md:gap-1 lg:gap-1.5 ${
                        pathname.startsWith('/panel/ayarlar') || pathname.startsWith('/panel/kullanicilar') || pathname.startsWith('/panel/guvenlik')
                          ? 'text-blue-700 bg-blue-50 font-semibold' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                      }`} aria-expanded={settingsDropOpen}>
                        Ayarlar
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </button>
                      {settingsDropOpen && (
                        <div className="absolute top-full left-0 mt-1.5 w-56 bg-white rounded-2xl shadow-xl border border-slate-100/80 py-1.5 z-[70]">
                          <Link href="/panel/ayarlar/kurulum" className="block mx-1 px-3 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-50/60 rounded-lg transition-colors flex items-center gap-2" onClick={() => setSettingsDropOpen(false)}>
                            <span className="text-base leading-none">⚙️</span>
                            Kurulum Sihirbazı
                          </Link>
                          <Link href="/panel/ayarlar/sablonlar" className="block mx-1 px-3 py-2.5 text-sm text-slate-700 hover:bg-blue-50/60 hover:text-blue-700 rounded-lg transition-colors flex items-center gap-2" onClick={() => setSettingsDropOpen(false)}>
                            <span className="text-base leading-none">📝</span>
                            Şablonlar
                          </Link>
                          <Link href="/panel/ayarlar/tanimlar" className="block mx-1 px-3 py-2.5 text-sm text-slate-700 hover:bg-blue-50/60 hover:text-blue-700 rounded-lg transition-colors flex items-center gap-2" onClick={() => setSettingsDropOpen(false)}>
                            <span className="text-base leading-none">🏷️</span>
                            Tanımlar
                          </Link>
                          <Link href="/panel/ayarlar/sigorta-sirketleri" className="block mx-1 px-3 py-2.5 text-sm text-slate-700 hover:bg-blue-50/60 hover:text-blue-700 rounded-lg transition-colors flex items-center gap-2" onClick={() => setSettingsDropOpen(false)}>
                            <span className="text-base leading-none">🏢</span>
                            Sigorta Şirketleri
                          </Link>
                          <Link href="/panel/ayarlar/fiyat-yonetimi" className="block mx-1 px-3 py-2.5 text-sm text-slate-700 hover:bg-blue-50/60 hover:text-blue-700 rounded-lg transition-colors flex items-center gap-2" onClick={() => setSettingsDropOpen(false)}>
                            <span className="text-base leading-none">💰</span>
                            Fiyat Yönetimi
                          </Link>
                          <div className="my-1 border-t border-slate-100" />
                          <Link href="/panel/guvenlik/erisim-loglari" className="block mx-1 px-3 py-2.5 text-sm text-slate-500 hover:bg-slate-50/60 hover:text-slate-700 rounded-lg transition-colors flex items-center gap-2" onClick={() => setSettingsDropOpen(false)}>
                            <span className="text-base leading-none">🔒</span>
                            Güvenlik
                          </Link>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </nav>
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
            {!isPortalUser && (
              <>
                <Link href="/panel" className="block px-3 py-2 text-sm text-slate-700 hover:bg-blue-50/60 hover:text-blue-700 rounded-lg transition-colors" onClick={() => setMobileMenuOpen(false)}>Dashboard</Link>
                {canSee('/panel/hasar-dosyalari') && (
                  <Link
                    href="/panel/operasyon"
                    className="block px-3 py-2 text-sm text-slate-700 hover:bg-blue-50/60 hover:text-blue-700 rounded-lg transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Operasyon
                    {pendingRevisionCount > 0 && (
                      <span className="ml-1.5 inline-flex items-center justify-center min-w-[16px] h-4 px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold">
                        {pendingRevisionCount > 99 ? '99+' : pendingRevisionCount}
                      </span>
                    )}
                  </Link>
                )}
                {canSee('/panel/personel-yonetimi') && (
                  <Link href="/panel/personel-yonetimi" className="block px-3 py-2 text-sm text-slate-700 hover:bg-blue-50/60 hover:text-blue-700 rounded-lg transition-colors" onClick={() => setMobileMenuOpen(false)}>Personel</Link>
                )}
                {canSee('/panel/musteriler') && (
                  <Link href="/panel/musteriler" className="block px-3 py-2 text-sm text-slate-700 hover:bg-blue-50/60 hover:text-blue-700 rounded-lg transition-colors" onClick={() => setMobileMenuOpen(false)}>Müşteriler</Link>
                )}
                {canSee('/panel/tedarikciler') && (
                  <Link href="/panel/tedarikciler" className="block px-3 py-2 text-sm text-slate-700 hover:bg-blue-50/60 hover:text-blue-700 rounded-lg transition-colors" onClick={() => setMobileMenuOpen(false)}>Tedarikçiler</Link>
                )}
                {canSee('/panel/finans') && (
                  <>
                    <Link href="/panel/finans/faturalar" className="block px-3 py-2 text-sm text-slate-700 hover:bg-blue-50/60 hover:text-blue-700 rounded-lg transition-colors" onClick={() => setMobileMenuOpen(false)}>Faturalar</Link>
                    <Link href="/panel/raporlar/dosya-performansi" className="block px-3 py-2 text-sm text-slate-700 hover:bg-blue-50/60 hover:text-blue-700 rounded-lg transition-colors" onClick={() => setMobileMenuOpen(false)}>Raporlar</Link>
                  </>
                )}
                {canSee('/panel/ayarlar') && (
                  <>
                    <Link href="/panel/ayarlar/kurulum" className="block px-3 py-2 text-sm text-slate-700 hover:bg-blue-50/60 hover:text-blue-700 rounded-lg transition-colors" onClick={() => setMobileMenuOpen(false)}>Kurulum Sihirbazı</Link>
                    <Link href="/panel/ayarlar/sablonlar" className="block px-3 py-2 text-sm text-slate-700 hover:bg-blue-50/60 hover:text-blue-700 rounded-lg transition-colors" onClick={() => setMobileMenuOpen(false)}>Şablonlar</Link>
                    <Link href="/panel/ayarlar/tanimlar" className="block px-3 py-2 text-sm text-slate-700 hover:bg-blue-50/60 hover:text-blue-700 rounded-lg transition-colors" onClick={() => setMobileMenuOpen(false)}>Tanımlar</Link>
                    <Link href="/panel/ayarlar/sigorta-sirketleri" className="block px-3 py-2 text-sm text-slate-700 hover:bg-blue-50/60 hover:text-blue-700 rounded-lg transition-colors" onClick={() => setMobileMenuOpen(false)}>Sigorta Şirketleri</Link>
                    <Link href="/panel/ayarlar/fiyat-yonetimi" className="block px-3 py-2 text-sm text-slate-700 hover:bg-blue-50/60 hover:text-blue-700 rounded-lg transition-colors" onClick={() => setMobileMenuOpen(false)}>Fiyat Yönetimi</Link>
                    <Link href="/panel/guvenlik/erisim-loglari" className="block px-3 py-2 text-sm text-slate-700 hover:bg-blue-50/60 hover:text-blue-700 rounded-lg transition-colors" onClick={() => setMobileMenuOpen(false)}>Güvenlik</Link>
                  </>
                )}
              </>
            )}
            {isExpert && (
              <>
                <Link href="/panel/eksper-portal" className="block px-3 py-2 text-sm text-slate-700 hover:bg-blue-50/60 hover:text-blue-700 rounded-lg transition-colors" onClick={() => setMobileMenuOpen(false)}>Dashboard</Link>
                <Link href="/panel/eksper-portal/onaylar" className="block px-3 py-2 text-sm text-slate-700 hover:bg-blue-50/60 hover:text-blue-700 rounded-lg transition-colors" onClick={() => setMobileMenuOpen(false)}>Bekleyen Onaylar</Link>
              </>
            )}
            {isInsuranceCompanyUser && (
              <>
                <Link href="/panel/sigorta-portal" className="block px-3 py-2 text-sm text-slate-700 hover:bg-blue-50/60 hover:text-blue-700 rounded-lg transition-colors" onClick={() => setMobileMenuOpen(false)}>Dashboard</Link>
                <Link href="/panel/sigorta-portal/dosyalar" className="block px-3 py-2 text-sm text-slate-700 hover:bg-blue-50/60 hover:text-blue-700 rounded-lg transition-colors" onClick={() => setMobileMenuOpen(false)}>Dosyalar</Link>
              </>
            )}
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

  // Tema localStorage'dan oku — SSR safe
  useEffect(() => {
    try {
      // Dark mode devre dışı — her zaman açık tema
      const html = document.documentElement;
      html.classList.remove('dark');
      const saved = localStorage.getItem('app-theme');
      if (saved) {
        const { colorScheme } = JSON.parse(saved) as { mode?: string; colorScheme?: string };
        if (colorScheme) {
          html.setAttribute('data-color-scheme', colorScheme);
        }
      }
    } catch { /* localStorage erişim hatası yoksay */ }
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
    const token = localStorage.getItem('accessToken');
    if (!token) {
      router.push('/giris');
      return;
    }
    const userData = localStorage.getItem('user');
    if (userData) setUser(JSON.parse(userData));
    setLoading(false);

    // Ekran izinlerini DB'den çek
    fetch(`${API_BASE}/api/v1/users/me/permissions`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => { if (json?.data?.screens) setAllowedScreens(json.data.screens); })
      .catch(() => { /* DB izin yoksa role-default'a düşülür */ });
  }, [router]);

  // Onaylanmamış sözleşme kontrolü
  useEffect(() => {
    if (loading) return;
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    fetch(`${API_BASE}/api/v1/agreements/pending`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.data) setPendingAgreements(json.data);
      })
      .catch(() => {})
      .finally(() => setAgreementsChecked(true));
  }, [loading]);

  const fetchUnreadCount = useCallback(async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setUnreadCount(json?.data?.count ?? 0);
      }
    } catch {}
  }, []);

  const fetchNotifications = useCallback(async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/notifications?limit=20`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setNotifications(json?.data ?? []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!loading) {
      fetchUnreadCount();
      const interval = setInterval(fetchUnreadCount, 60000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [loading, fetchUnreadCount]);

  useEffect(() => {
    if (!loading) {
      const token = localStorage.getItem('accessToken');
      if (!token) return;
      fetch(`${API_BASE}/api/v1/revision-requests?status=PENDING&limit=1`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.ok ? r.json() : null)
        .then((json) => { if (json) setPendingRevisionCount(json?.meta?.total ?? json?.data?.length ?? 0); })
        .catch(() => { setPendingRevisionCount(3); });
    }
  }, [loading]);

  const handleNotifOpen = async () => {
    const newOpen = !notifOpen;
    setNotifOpen(newOpen);
    if (newOpen) await fetchNotifications();
  };

  const handleMarkRead = async (notifId: string) => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    try {
      await fetch(`${API_BASE}/api/v1/notifications/${notifId}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications((prev) => prev.map((n) => (n.id === notifId ? { ...n, status: 'read' } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {}
  };

  const handleMarkAllRead = async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    try {
      await fetch(`${API_BASE}/api/v1/notifications/read-all`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
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

  const isPublicPanelPath = pathname === '/panel/profil';
  const accessDenied =
    !loading && !isPortalUser && !isPublicPanelPath && roleCode !== '' && !hasRouteAccess(pathname, roleCode);

  const navbarProps = {
    user, pathname, roleCode, isPortalUser, isExpert, isInsuranceCompanyUser,
    pendingRevisionCount, onLogout: handleLogout,
    unreadCount, notifOpen, onNotifOpen: handleNotifOpen,
    onNotifClose: () => setNotifOpen(false),
    notifications, onMarkRead: handleMarkRead, onMarkAllRead: handleMarkAllRead,
    onNotifClick: handleNotifClick, relativeTime, notifTypeColor, notifTypeBorder, notifTypeIcon,
    allowedScreens,
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Yükleniyor...</p>
        </div>
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
        {agreementsChecked && pendingAgreements.length > 0 && (
          <AgreementConsentModal
            pendingAgreements={pendingAgreements}
            onAllAccepted={() => setPendingAgreements([])}
          />
        )}
        <main className="flex-1">
          <div className="mx-auto max-w-screen-2xl px-4 py-6">
            <TopProgressBar /><ToastProvider>{children}</ToastProvider>
          </div>
        </main>
        <SessionTimeoutBar />
      </div>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
