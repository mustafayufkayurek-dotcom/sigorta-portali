'use client';

import Link from 'next/link';
import { ChevronLeft, ChevronRight, FilePlus, LifeBuoy } from 'lucide-react';
import { BrandLogoMark } from '@/components/brand/BrandLogoMark';
import { CORPORATE_LOGO_LIGHT } from '@/constants/brand';
import {
  resolvePanelContextLabel,
  canShowNewClaimQuickAction,
} from '@/config/panel-user-guide';

type PanelSidebarChromeProps = {
  user: {
    firstName?: string;
    lastName?: string;
    role?: { name?: string; code?: string };
    email?: string;
  } | null;
  roleCode: string;
  isExpert: boolean;
  isInsuranceCompanyUser: boolean;
  isFinance: boolean;
  isFieldStaff: boolean;
  isOfficeStaff: boolean;
  showAcilYardim: boolean;
  homeHref: string;
  companyLogo?: string | null;
  collapsed: boolean;
  onToggleCollapsed: () => void;
};

function userInitials(user: PanelSidebarChromeProps['user']): string {
  const first = user?.firstName?.trim()?.[0] ?? '';
  const last = user?.lastName?.trim()?.[0] ?? '';
  const combo = `${first}${last}`.toUpperCase();
  if (combo) return combo;
  return (user?.email?.[0] ?? 'K').toUpperCase();
}

function userDisplayName(user: PanelSidebarChromeProps['user']): string {
  const full = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  return full || user?.email || 'Kullanıcı';
}

export function PanelSidebarChrome({
  user,
  roleCode,
  isExpert,
  isInsuranceCompanyUser,
  isFinance,
  isFieldStaff,
  isOfficeStaff,
  showAcilYardim,
  homeHref,
  companyLogo,
  collapsed,
  onToggleCollapsed,
}: PanelSidebarChromeProps) {
  const contextLabel = resolvePanelContextLabel({
    roleCode,
    isExpert,
    isInsuranceCompanyUser,
    isFinance,
    isFieldStaff,
    isOfficeStaff,
  });
  const showClaimActions = canShowNewClaimQuickAction({ isExpert, isInsuranceCompanyUser, isFieldStaff });
  const logoSrc = companyLogo || CORPORATE_LOGO_LIGHT;
  const roleLine = user?.role?.name ?? contextLabel;

  return (
    <div className={`shrink-0 border-b border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-950 ${collapsed ? 'px-2 py-2.5' : 'px-3 py-3'}`}>
      <div className={`flex items-center gap-2 ${collapsed ? 'flex-col' : ''}`}>
        <Link
          href={homeHref}
          title="Panel ana sayfa"
          className={`min-w-0 ${collapsed ? 'flex justify-center' : 'flex-1'}`}
        >
          <BrandLogoMark
            alt="Meridyen Assistance"
            src={logoSrc}
            variant={collapsed ? 'portal' : 'panel'}
          />
        </Link>
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:border-slate-700 dark:hover:bg-slate-800"
          aria-label={collapsed ? 'Menüyü genişlet' : 'Menüyü daralt'}
          title={collapsed ? 'Menüyü genişlet' : 'Menüyü daralt'}
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
      </div>

      <Link
        href="/panel/profil"
        title={userDisplayName(user)}
        className={`mt-2.5 flex items-center transition hover:opacity-90 ${collapsed ? 'justify-center' : 'gap-2.5 rounded-lg px-1 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-900/50'}`}
      >
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white">
          {userInitials(user)}
        </span>
        {!collapsed ? (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-slate-900 dark:text-slate-100">
              {userDisplayName(user)}
            </span>
            <span className="block truncate text-xs text-slate-500">{roleLine}</span>
          </span>
        ) : null}
      </Link>

      {showClaimActions && !collapsed ? (
        <div className="mt-2 flex gap-1.5">
          <Link
            href="/panel/hasar-dosyalari/yeni"
            className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-slate-900 px-2 py-1.5 text-[11px] font-semibold text-white transition hover:bg-slate-800"
          >
            <FilePlus className="h-3 w-3" />
            Yeni Hasar
          </Link>
          {showAcilYardim ? (
            <Link
              href="/panel/acil-yardim/yeni"
              className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] font-semibold text-amber-900 transition hover:bg-amber-100"
            >
              <LifeBuoy className="h-3 w-3" />
              Yeni Acil
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
