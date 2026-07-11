/**
 * Rol bazlı panel kullanım kılavuzları.
 * HTML kılavuz güncellendiğinde GUIDE_CONTENT_VERSION artırılmalıdır.
 */
export const GUIDE_CONTENT_VERSION = '2026-07-11b';

export type PanelGuideEntry = {
  href: string;
  title: string;
  subtitle: string;
};

export type PanelGuideContext = {
  roleCode: string;
  isExpert?: boolean;
  isInsuranceCompanyUser?: boolean;
  isFinance?: boolean;
  isFieldStaff?: boolean;
  isOfficeStaff?: boolean;
};

const PERSONEL_HTML = '/docs/01-personel-kullanim-kilavuzu.html';

function normalizeRole(code: string): string {
  return String(code ?? '').trim().toLowerCase().replace(/-/g, '_');
}

const GUIDE_BY_ROLE: Record<string, PanelGuideEntry> = {
  expert: {
    href: '/docs/03-eksper-portal-tanitim.html',
    title: 'Eksper Portal Kılavuzu',
    subtitle: 'Dosya yükleme, onaylar ve randevular',
  },
  insurance_company_user: {
    href: '/docs/02-sigorta-portal-kilavuzu.html',
    title: 'Sigorta Portal Kılavuzu',
    subtitle: 'Dosya akışı, onaylar ve faturalar',
  },
  broker_user: {
    href: '/docs/04-broker-portal-kilavuzu.html',
    title: 'Broker Portal Kılavuzu',
    subtitle: 'Dosya takibi ve portal kullanımı',
  },
  field_staff: {
    href: `${PERSONEL_HTML}#saha-personeli`,
    title: 'Saha Personeli Kılavuzu',
    subtitle: 'Hasar, acil yardım ve carilerim',
  },
  finance: {
    href: `${PERSONEL_HTML}#finans-modulleri`,
    title: 'Finans Kullanım Kılavuzu',
    subtitle: 'Fatura, tahsilat, masraf ve raporlar',
  },
  finans: {
    href: `${PERSONEL_HTML}#finans-modulleri`,
    title: 'Finans Kullanım Kılavuzu',
    subtitle: 'Fatura, tahsilat, masraf ve raporlar',
  },
  accountant: {
    href: `${PERSONEL_HTML}#finans-modulleri`,
    title: 'Finans Kullanım Kılavuzu',
    subtitle: 'Fatura, tahsilat, masraf ve raporlar',
  },
  office_staff: {
    href: `${PERSONEL_HTML}#dosya-merkezi`,
    title: 'Dosya Sorumlusu Kılavuzu',
    subtitle: 'Operasyon, müşteri ve dosya yönetimi',
  },
  manager: {
    href: `${PERSONEL_HTML}#dosya-sorumlusu`,
    title: 'Yönetici Kullanım Kılavuzu',
    subtitle: 'Sistemi verimli kullanmanız için adım adım rehber',
  },
  admin: {
    href: `${PERSONEL_HTML}#operasyon-merkezi`,
    title: 'Yönetici Kullanım Kılavuzu',
    subtitle: 'Sistemi verimli kullanmanız için adım adım rehber',
  },
};

const DEFAULT_GUIDE: PanelGuideEntry = {
  href: `${PERSONEL_HTML}#operasyon-merkezi`,
  title: 'Personel Kullanım Kılavuzu',
  subtitle: 'Panel menüleri ve günlük iş akışları',
};

export function resolvePanelUserGuide(ctx: PanelGuideContext | string): PanelGuideEntry {
  if (typeof ctx === 'string') {
    return resolvePanelUserGuide({ roleCode: ctx });
  }

  if (ctx.isExpert) return GUIDE_BY_ROLE.expert;
  if (ctx.isInsuranceCompanyUser) return GUIDE_BY_ROLE.insurance_company_user;
  if (ctx.isFinance) return GUIDE_BY_ROLE.finans;
  if (ctx.isFieldStaff) return GUIDE_BY_ROLE.field_staff;
  if (ctx.isOfficeStaff) return GUIDE_BY_ROLE.office_staff;

  const role = normalizeRole(ctx.roleCode);
  if (GUIDE_BY_ROLE[role]) return GUIDE_BY_ROLE[role];
  return DEFAULT_GUIDE;
}

export function resolvePanelContextLabel(opts: {
  roleCode: string;
  isExpert: boolean;
  isInsuranceCompanyUser: boolean;
  isFinance: boolean;
  isFieldStaff: boolean;
  isOfficeStaff: boolean;
}): string {
  if (opts.isExpert) return 'Eksper Portalı';
  if (opts.isInsuranceCompanyUser) return 'Sigorta Portalı';
  if (opts.isFieldStaff) return 'Saha Merkezi';
  if (opts.isFinance) return 'Finans Merkezi';
  if (opts.isOfficeStaff) return 'Dosya Merkezi';
  const role = normalizeRole(opts.roleCode);
  if (role === 'admin' || role === 'manager') return 'Operasyon Merkezi';
  return 'Operasyon Merkezi';
}

export function canShowNewClaimQuickAction(opts: {
  isExpert: boolean;
  isInsuranceCompanyUser: boolean;
  isFieldStaff: boolean;
}): boolean {
  return !opts.isExpert && !opts.isInsuranceCompanyUser;
}
