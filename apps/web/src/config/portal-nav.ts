import type { LucideIcon } from 'lucide-react';
import {
  Building2,
  ClipboardList,
  FileText,
  FolderOpen,
  GitBranch,
  LayoutDashboard,
  MapPin,
  ShieldCheck,
} from 'lucide-react';

export type PortalNavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  exactMatch?: boolean;
  alertCount?: number;
};

export type ExpertPortalNavCounts = {
  dosyalar?: number;
  onay?: number;
  rapor?: number;
  onaylanan?: number;
  /** @deprecated — onaylanan kullanın */
  raporOnay?: number;
};

export type InsurancePortalNavCounts = {
  /** Yalnız Bekleyen Onaylar rozeti */
  onay?: number;
};

/**
 * FINAL MASTER — Eksper sidebar.
 * Özet rozet yalnız «Onay Bekliyor».
 */
export function getExpertPortalNav(counts?: ExpertPortalNavCounts): PortalNavItem[] {
  return [
    { title: 'Eksper Paneli', href: '/panel/eksper-portal', icon: LayoutDashboard, exactMatch: true },
    {
      title: 'Dosyalarım',
      href: '/panel/eksper-portal/dosyalar',
      icon: FolderOpen,
    },
    {
      title: 'Onay Bekliyor',
      href: '/panel/eksper-portal/dosyalar?queue=onay',
      icon: ShieldCheck,
      alertCount: counts?.onay,
    },
    {
      title: 'Rapor Bekleyenler',
      href: '/panel/eksper-portal/dosyalar?queue=rapor',
      icon: FileText,
    },
    {
      title: 'Onaylanan Dosyalar',
      href: '/panel/eksper-portal/dosyalar?queue=onaylanan',
      icon: ClipboardList,
    },
  ];
}

/**
 * Sigorta — Dosya Takip.
 * İhbar tanımlama + tespit izleme + onay (onay yetkisi sigorta kullanıcısında da vardır).
 * Dosya Akışı menüde yok; Dosyalar satırından açılır.
 */
export function getInsurancePortalNav(counts?: InsurancePortalNavCounts): PortalNavItem[] {
  return [
    { title: 'Dosya Takip', href: '/panel/sigorta-portal', icon: Building2, exactMatch: true },
    { title: 'Dosyalar', href: '/panel/sigorta-portal/dosyalar', icon: ClipboardList },
    {
      title: 'Bekleyen Onaylar',
      href: '/panel/sigorta-portal/onaylar',
      icon: ShieldCheck,
      alertCount: counts?.onay,
    },
    { title: 'Canlı İzle', href: '/panel/sigorta-portal/canli-izle', icon: MapPin },
    { title: 'Faturalar', href: '/panel/sigorta-portal/faturalar', icon: FileText },
    { title: 'Operasyon Ağı', href: '/panel/sigorta-portal/operasyon-agi', icon: GitBranch },
  ];
}

/** Mobil alt çubuk — kısa etiketler */
export const PORTAL_BOTTOM_SHORT_LABELS: Record<string, string> = {
  'Eksper Paneli': 'Panel',
  Dosyalarım: 'Dosyalarım',
  'Onay Bekliyor': 'Onay',
  'İnceleme Bekleyenler': 'Onay',
  'Rapor Bekleyenler': 'Rapor',
  'Onaylanan Dosyalar': 'Onaylanan',
  'Rapor Onaylarım': 'Onaylanan',
  'Onay Bekleyenler': 'Onaylanan',
  'Yeni İhbar': 'İhbar',
  'Dosya Akışı': 'Akış',
  'Bekleyen Onaylar': 'Onaylar',
  'Sigorta Paneli': 'Takip',
  'Dosya İzleme': 'Takip',
  'Dosya Takip': 'Takip',
  'Atanmış Dosyalar': 'Dosyalar',
  Dosyalar: 'Dosyalar',
  'Canlı İzle': 'Canlı',
  Faturalar: 'Faturalar',
  'Operasyon Ağı': 'Ağ',
};

export function isPortalNavActive(pathname: string, href: string, exactMatch?: boolean): boolean {
  const normalizedHref = href.split('?')[0];
  if (exactMatch) return pathname === normalizedHref;
  return pathname === normalizedHref || pathname.startsWith(`${normalizedHref}/`);
}

/** @deprecated — Yeni İhbar header CTA’dan açılır; nav’da yok */
export const EXPERT_YENI_IHBAR_HREF = '/panel/eksper-portal?openIhbar=1';
