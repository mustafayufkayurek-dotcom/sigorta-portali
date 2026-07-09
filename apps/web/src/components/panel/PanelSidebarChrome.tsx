'use client';

import Link from 'next/link';
import { FilePlus, LifeBuoy, User } from 'lucide-react';
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

  return (
    <div className={`shrink-0 border-b border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-950 ${collapsed ? 'px-2 py-3' : 'px-3 py-4'}`}>
      <div className={`mb-3 flex ${collapsed ? 'justify-center' : 'justify-start'}`}>
        <Link href={homeHref} title="Panel ana sayfa" className="inline-flex">
          <BrandLogoMark
            alt="Meridyen Assistance"
            src={logoSrc}
            variant={collapsed ? 'portal' : 'panel'}
          />
        </Link>
      </div>

      {!collapsed ? (
        <Link
          href="/panel/profil"
          className="mb-3 flex items-center gap-3 rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-2.5 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/60"
        >
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
            {userInitials(user)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
              {userDisplayName(user)}
            </span>
            <span className="block truncate text-xs text-slate-500">{user?.role?.name ?? contextLabel}</span>
          </span>
          <User className="h-4 w-4 shrink-0 text-slate-400" />
        </Link>
      ) : (
        <Link
          href="/panel/profil"
          title={userDisplayName(user)}
          className="mb-3 mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white"
        >
          {userInitials(user)}
        </Link>
      )}

      {!collapsed && (
        <p className="mb-3 px-1 text-[11px] font-medium text-slate-400">{contextLabel}</p>
      )}

      {showClaimActions && !collapsed && (
        <div className="mb-3 grid grid-cols-2 gap-2">
          <Link
            href="/panel/hasar-dosyalari/yeni"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
          >
            <FilePlus className="h-3.5 w-3.5" />
            Yeni Hasar
          </Link>
          {showAcilYardim ? (
            <Link
              href="/panel/acil-yardim/yeni"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-700 transition hover:border-amber-200 hover:bg-amber-50 hover:text-amber-800"
            >
              <LifeBuoy className="h-3.5 w-3.5" />
              Yeni Acil
            </Link>
          ) : (
            <span className="rounded-lg border border-dashed border-slate-200 px-2 py-2 text-center text-[10px] text-slate-400">
              Acil yetkisi yok
            </span>
          )}
        </div>
      )}

    </div>
  );
}
