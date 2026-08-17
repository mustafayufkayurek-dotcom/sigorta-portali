import { flattenSettingsNavLinks } from '@/config/settings-nav';
import { DEFINITION_SETTINGS_PAGES, TANIMLAR_BACK_HREF } from '@/utils/settings-definition-nav';

export interface SettingsBreadcrumb {
  label: string;
  href?: string;
}

const DEFINITION_PAGE_LABELS: Record<string, string> = {
  '/panel/ayarlar/musteri-tipleri': 'Müşteri Tipleri',
  '/panel/ayarlar/eksper-sigorta-iliskileri': 'Eksper–Sigorta İlişkileri',
  '/panel/ayarlar/departmanlar': 'Departmanlar',
  '/panel/ayarlar/iliski-turleri': 'İlişki Türleri',
  '/panel/ayarlar/dosya-konulari': 'Dosya Konuları',
  '/panel/ayarlar/durumlar': 'Durumlar',
  '/panel/ayarlar/evrak-turleri': 'Evrak Türleri',
  '/panel/ayarlar/hizmet-turleri': 'Dosya Konuları',
  '/panel/ayarlar/hizmet-branslari': 'Dosya Konuları',
  '/panel/ayarlar/tedarikci-hizmet-kollari': 'Tedarikçi Hizmet Kolları',
  '/panel/ayarlar/is-gruplari': 'İş Grupları',
  '/panel/ayarlar/masraf-kategorileri': 'Masraf Kategorileri',
  '/panel/ayarlar/mahaller': 'Mahal ve Bölgeler',
  '/panel/ayarlar/fiyat-listesi': 'Fiyat Listesi',
  '/panel/ayarlar/bolgesel-zamlar': 'Bölgesel Zamlar',
  '/panel/ayarlar/eskalasyon-kurallari': 'Eskalasyon Kuralları',
};

const definitionPaths = new Set<string>(DEFINITION_SETTINGS_PAGES);

export function isDefinitionSettingsPath(pathname: string): boolean {
  return definitionPaths.has(pathname);
}

/** Ayarlar alt sayfaları için sıralı breadcrumb zinciri */
export function getSettingsBreadcrumbs(pathname: string, pageTitle?: string): SettingsBreadcrumb[] {
  const normalized = pathname.split('?')[0];

  if (normalized === '/panel/ayarlar') {
    return [{ label: 'Ayarlar' }];
  }

  const ayarlarRoot: SettingsBreadcrumb = { label: 'Ayarlar', href: '/panel/ayarlar' };

  if (normalized === '/panel/ayarlar/tanimlar') {
    return [ayarlarRoot, { label: 'Tanımlar Merkezi' }];
  }

  if (definitionPaths.has(normalized)) {
    const label = pageTitle ?? DEFINITION_PAGE_LABELS[normalized] ?? 'Tanım';
    const viaTanimlar = normalized === '/panel/ayarlar/eksper-sigorta-iliskileri'
      ? false
      : DEFINITION_PAGE_LABELS[normalized] !== undefined;
    if (viaTanimlar) {
      return [
        ayarlarRoot,
        { label: 'Tanımlar Merkezi', href: TANIMLAR_BACK_HREF },
        { label },
      ];
    }
    return [ayarlarRoot, { label }];
  }

  const navLink = flattenSettingsNavLinks().find((item) => item.href === normalized);
  if (navLink) {
    return [ayarlarRoot, { label: navLink.title }];
  }

  if (pageTitle) {
    return [ayarlarRoot, { label: pageTitle }];
  }

  return [ayarlarRoot];
}
