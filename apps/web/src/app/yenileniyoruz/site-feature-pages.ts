export const SITE_FEATURE_PAGES = {
  'konut-endustriyel-onarim': {
    title: 'Konut ve Endüstriyel Onarım',
    teaser: 'Yenileniyoruz ...',
    map: false,
  },
  'sektor-ozel-yazilim': {
    title: 'Sektöre Özel Yazılım Hizmetleri',
    teaser: 'Yenileniyoruz ...',
    map: false,
  },
  'eksper-koordinasyon': {
    title: 'Eksper Koordinasyon Ağı',
    teaser: 'Yenileniyoruz ...',
    map: false,
  },
  turkiye: {
    title: "Tüm Türkiye'deyiz",
    teaser: 'Yenileniyoruz ...',
    map: false,
  },
} as const;

export type SiteFeatureSlug = keyof typeof SITE_FEATURE_PAGES;
