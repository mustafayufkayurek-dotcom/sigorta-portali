import type { LucideIcon } from 'lucide-react';
import { Building2, ClipboardList, FileText, GitBranch, Plus, ShieldCheck, Users } from 'lucide-react';

export type PortalNavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  exactMatch?: boolean;
};

export function getExpertPortalNav(): PortalNavItem[] {
  return [
    { title: 'Yeni İhbar', href: '/panel/eksper-portal?openIhbar=1', icon: Plus },
    { title: 'Eksper Paneli', href: '/panel/eksper-portal', icon: Users, exactMatch: true },
    { title: 'Dosya Akışı', href: '/panel/eksper-portal/randevular', icon: GitBranch },
    { title: 'Bekleyen Onaylar', href: '/panel/eksper-portal/onaylar', icon: ShieldCheck },
    { title: 'Atanmış Dosyalar', href: '/panel/eksper-portal/dosyalar', icon: ClipboardList },
  ];
}

export function getInsurancePortalNav(): PortalNavItem[] {
  return [
    { title: 'Sigorta Paneli', href: '/panel/sigorta-portal', icon: Building2, exactMatch: true },
    { title: 'Bekleyen Onaylar', href: '/panel/sigorta-portal/onaylar', icon: ShieldCheck },
    { title: 'Dosyalar', href: '/panel/sigorta-portal/dosyalar', icon: ClipboardList },
    { title: 'Dosya Akışı', href: '/panel/sigorta-portal/dosya-akisi', icon: GitBranch },
    { title: 'Faturalar', href: '/panel/sigorta-portal/faturalar', icon: FileText },
  ];
}

/** Mobil alt çubuk — kısa etiketler */
export const PORTAL_BOTTOM_SHORT_LABELS: Record<string, string> = {
  'Yeni İhbar': 'İhbar',
  'Eksper Paneli': 'Panel',
  'Dosya Akışı': 'Akış',
  'Bekleyen Onaylar': 'Onaylar',
  'Atanmış Dosyalar': 'Dosyalar',
  'Sigorta Paneli': 'Panel',
  Dosyalar: 'Dosyalar',
  Faturalar: 'Faturalar',
};

export function isPortalNavActive(pathname: string, href: string, exactMatch?: boolean): boolean {
  const normalizedHref = href.split('?')[0];
  if (exactMatch) return pathname === normalizedHref;
  return pathname === normalizedHref || pathname.startsWith(`${normalizedHref}/`);
}
