import {
  findHizmetKarti,
  hizmetKartiCodeForClaim,
  mailRouteFromHizmetKarti,
  mergeHizmetKartlari,
  type HizmetKarti,
} from '@sigorta/shared';

type SettingsReader = {
  systemSetting: {
    findUnique: (args: { where: { key: string } }) => Promise<{ value?: unknown } | null>;
  };
};

export async function loadHizmetKartlari(prisma: SettingsReader): Promise<HizmetKarti[]> {
  try {
    const row = await prisma.systemSetting.findUnique({ where: { key: 'hizmet_kartlari' } });
    return mergeHizmetKartlari(row?.value ?? null);
  } catch {
    return mergeHizmetKartlari(null);
  }
}

export async function serviceMailRouteForClaim(
  prisma: SettingsReader,
  claim: {
    serviceKind?: unknown;
    consultancyServiceType?: { code?: string | null; name?: string | null } | null;
  },
) {
  const cards = await loadHizmetKartlari(prisma);
  const card = findHizmetKarti(cards, hizmetKartiCodeForClaim(claim));
  return { card, route: mailRouteFromHizmetKarti(card) };
}
