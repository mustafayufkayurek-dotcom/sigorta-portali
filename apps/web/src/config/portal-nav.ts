import type { LucideIcon } from 'lucide-react';
import {
  Building2,
  ClipboardList,
  FileSearch,
  FileText,
  FolderOpen,
  GitBranch,
  LayoutDashboard,
  ShieldCheck,
} from 'lucide-react';

export type PortalNavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  exactMatch?: boolean;
  alertCount?: number;
};

/** FINAL MASTER — Eksper sidebar / dil: Dosyalarım; Atanmış yok. */
export function getExpertPortalNav(): PortalNavItem[] {
  return [
    { title: 'Eksper Paneli', href: '/panel/eksper-portal', icon: LayoutDashboard, exactMatch: true },
    { title: 'Dosyalarım', href: '/panel/eksper-portal/dosyalar', icon: FolderOpen },
    {
      title: 'İnceleme Bekleyenler',
      href: '/panel/eksper-portal/dosyalar?queue=inceleme',
      icon: FileSearch,
    },
    {
      title: 'Rapor Bekleyenler',
      href: '/panel/eksper-portal/dosyalar?queue=rapor',
      icon: FileText,
    },
    {
      title: 'Onay Bekleyenler',
      href: '/panel/eksper-portal/onaylar',
      icon: ShieldCheck,
    },
  ];
}

export function getInsurancePortalNav(): PortalNavItem[] {
  return [
    { title: 'Sigorta Paneli', href: '/panel/sigorta-portal', icon: Building2, exactMatch: true },
    { title: 'Bekleyen Onaylar', href: '/panel/sigorta-portal/onaylar', icon: ShieldCheck },
    { title: 'Atanmış Dosyalar', href: '/panel/sigorta-portal/dosyalar', icon: ClipboardList },
    { title: 'Dosya Akışı', href: '/panel/sigorta-portal/dosya-akisi', icon: GitBranch },
    { title: 'Faturalar', href: '/panel/sigorta-portal/faturalar', icon: FileText },
  ];
}

/** Mobil alt çubuk — kısa etiketler */
export const PORTAL_BOTTOM_SHORT_LABELS: Record<string, string> = {
  'Eksper Paneli': 'Panel',
  Dosyalarım: 'Dosyalarım',
  'İnceleme Bekleyenler': 'İnceleme',
  'Rapor Bekleyenler': 'Rapor',
  'Onay Bekleyenler': 'Onay',
  'Yeni İhbar': 'İhbar',
  'Dosya Akışı': 'Akış',
  'Bekleyen Onaylar': 'Onaylar',
  'Sigorta Paneli': 'Panel',
  'Atanmış Dosyalar': 'Dosyalar',
  Faturalar: 'Faturalar',
};

export function isPortalNavActive(pathname: string, href: string, exactMatch?: boolean): boolean {
  const normalizedHref = href.split('?')[0];
  if (exactMatch) return pathname === normalizedHref;
  return pathname === normalizedHref || pathname.startsWith(`${normalizedHref}/`);
}

/** @deprecated — Yeni İhbar header CTA’dan açılır; nav’da yok */
export const EXPERT_YENI_IHBAR_HREF = '/panel/eksper-portal?openIhbar=1';
