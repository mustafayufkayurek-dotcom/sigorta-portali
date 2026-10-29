export const HASAR_LIST_HIZMET_PARAM = 'hizmet';
export const HASAR_HIZMET_DANISMANLIK = 'danismanlik';
export const HASAR_HIZMET_TESPIT = 'hasar-tespit';
export const MUSTERI_KAYNAK_PARAM = 'kaynak';
export const MUSTERI_KAYNAK_ASISTANS = 'asistans';

export type OperasyonNavChild = {
  title: string;
  href: string;
  exactMatch?: boolean;
  groupOnly?: boolean;
  children?: OperasyonNavChild[];
};

export function sortNavByTitleTr<T extends { title: string; children?: T[]; groupStart?: boolean }>(
  items: T[],
): T[] {
  return [...items]
    .sort((a, b) => a.title.localeCompare(b.title, 'tr-TR'))
    .map((item) => {
      const next = { ...item };
      delete next.groupStart;
      if (item.children?.length) {
        next.children = sortNavByTitleTr(item.children);
      }
      return next;
    });
}

export function hasarListHrefForHizmet(hizmet: string): string {
  const code = String(hizmet ?? '').trim();
  if (!code) return '/panel/hasar-dosyalari';
  return `/panel/hasar-dosyalari?${HASAR_LIST_HIZMET_PARAM}=${encodeURIComponent(code)}`;
}

export function hasarListHrefForKaynak(kaynak: string): string {
  const code = normalizeMusteriKaynakParam(kaynak);
  if (!code) return '/panel/hasar-dosyalari';
  return `/panel/hasar-dosyalari?${MUSTERI_KAYNAK_PARAM}=${encodeURIComponent(code)}`;
}

export function acilListHrefForKaynak(kaynak: string): string {
  const code = normalizeMusteriKaynakParam(kaynak);
  if (!code) return '/panel/operasyon?filter=acil';
  return `/panel/operasyon?filter=acil&${MUSTERI_KAYNAK_PARAM}=${encodeURIComponent(code)}`;
}

export function normalizeHasarHizmetParam(raw: string | null | undefined): string | null {
  const v = String(raw ?? '').trim().toLowerCase().replace(/_/g, '-');
  if (!v) return null;
  if (v === 'inspection' || v === 'hasar-tespit') return HASAR_HIZMET_TESPIT;
  if (v === 'consultancy') return HASAR_HIZMET_DANISMANLIK;
  return v;
}

export function normalizeMusteriKaynakParam(raw: string | null | undefined): string | null {
  const v = String(raw ?? '').trim().toLowerCase().replace(/_/g, '-');
  if (!v) return null;
  if (v === 'asistans' || v === 'asistan' || v === 'asistan-firmasi' || v === 'asistans-firmasi') {
    return MUSTERI_KAYNAK_ASISTANS;
  }
  return v;
}

export function fallbackConsultancyNavTypes(): { name: string; code: string }[] {
  return [{ name: 'Hasar Tespit', code: HASAR_HIZMET_TESPIT }];
}

export function buildDanismanlikNavChildren(
  types: { name: string; code?: string | null }[] | null | undefined,
): OperasyonNavChild[] {
  const rows = (types ?? []).filter((t) => String(t.name ?? '').trim());
  const list = rows.length ? rows : fallbackConsultancyNavTypes();
  return sortNavByTitleTr(
    list.map((t) => {
      const code = normalizeHasarHizmetParam(t.code) || HASAR_HIZMET_TESPIT;
      return { title: String(t.name).trim(), href: hasarListHrefForHizmet(code) };
    }),
  );
}

export function buildAsistansNavChildren(): OperasyonNavChild[] {
  return sortNavByTitleTr([
    { title: 'Acil Yardım', href: acilListHrefForKaynak(MUSTERI_KAYNAK_ASISTANS) },
    { title: 'Hasar', href: hasarListHrefForKaynak(MUSTERI_KAYNAK_ASISTANS) },
  ]);
}

export function buildOperasyonNavChildren(
  types?: { name: string; code?: string | null }[] | null,
): OperasyonNavChild[] {
  const children: OperasyonNavChild[] = [
    { title: 'Dosya Özeti', href: '/panel/operasyon', exactMatch: true },
    { title: 'Gelen Kutusu', href: '/panel/operasyon/gelen-kutusu' },
    { title: 'Hasar Dosyaları', href: '/panel/hasar-dosyalari' },
    { title: 'Acil Yardım Dosyaları', href: '/panel/operasyon?filter=acil' },
    {
      title: 'Danışmanlık',
      href: hasarListHrefForHizmet(HASAR_HIZMET_DANISMANLIK),
      groupOnly: true,
      children: buildDanismanlikNavChildren(types),
    },
    {
      title: 'Asistans Hizmetleri',
      href: hasarListHrefForKaynak(MUSTERI_KAYNAK_ASISTANS),
      groupOnly: true,
      children: buildAsistansNavChildren(),
    },
  ];
  return sortNavByTitleTr(children);
}

export function acilListPageTitle(kaynak?: string | null): string {
  if (normalizeMusteriKaynakParam(kaynak) === MUSTERI_KAYNAK_ASISTANS) return 'Asistans Acil Yardım';
  return 'Acil Yardım Dosyaları';
}

export function hasarListPageTitle(hizmet: string | null, kaynak?: string | null): string {
  const kaynakCode = normalizeMusteriKaynakParam(kaynak);
  const code = normalizeHasarHizmetParam(hizmet);
  if (kaynakCode === MUSTERI_KAYNAK_ASISTANS && !code) return 'Asistans Hasar';
  if (!code) return 'Hasar Dosyaları';
  if (code === HASAR_HIZMET_TESPIT) return 'Hasar Tespit';
  if (code === HASAR_HIZMET_DANISMANLIK) return 'Danışmanlık';
  return code
    .split('-')
    .filter(Boolean)
    .map((p) => p.charAt(0).toLocaleUpperCase('tr-TR') + p.slice(1))
    .join(' ');
}

export function isHasarHizmetNavActive(
  pathname: string,
  href: string,
  activeHizmet: string | null,
  activeKaynak: string | null = null,
): boolean {
  const [path, qs = ''] = href.split('?');
  if (path !== '/panel/hasar-dosyalari') return false;
  if (pathname !== '/panel/hasar-dosyalari' && !pathname.startsWith('/panel/hasar-dosyalari/')) {
    return false;
  }
  const params = new URLSearchParams(qs);
  const hrefHizmet = normalizeHasarHizmetParam(params.get(HASAR_LIST_HIZMET_PARAM));
  const hrefKaynak = normalizeMusteriKaynakParam(params.get(MUSTERI_KAYNAK_PARAM));
  const currentHizmet = normalizeHasarHizmetParam(activeHizmet);
  const currentKaynak = normalizeMusteriKaynakParam(activeKaynak);
  if (pathname.startsWith('/panel/hasar-dosyalari/')) {
    return !hrefHizmet && !hrefKaynak;
  }
  return hrefHizmet === currentHizmet && hrefKaynak === currentKaynak;
}
