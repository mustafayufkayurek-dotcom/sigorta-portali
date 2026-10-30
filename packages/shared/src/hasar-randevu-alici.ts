/** Tespit/onarım randevu yazısı müşteri yetkilisine değil, dosyadaki irtibata gider. */

export type HasarRandevuAliciInput = {
  siteContactName?: string | null;
  siteContactPhone?: string | null;
  insuredName?: string | null;
  insuredPhone?: string | null;
  customerPhone?: string | null;
};

export type HasarRandevuAlici = {
  name: string;
  phone: string;
  viaIrtibat: boolean;
};

function trimText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function hasarRandevuAlici(input: HasarRandevuAliciInput | null | undefined): HasarRandevuAlici {
  const irtibatAd = trimText(input?.siteContactName);
  const irtibatTel = trimText(input?.siteContactPhone);
  const insuredName = trimText(input?.insuredName);
  const insuredPhone = trimText(input?.insuredPhone) || trimText(input?.customerPhone);
  if (irtibatTel) {
    return { name: irtibatAd || insuredName, phone: irtibatTel, viaIrtibat: true };
  }
  return { name: insuredName, phone: insuredPhone, viaIrtibat: false };
}
