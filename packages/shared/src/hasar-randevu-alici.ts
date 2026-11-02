/** Tespit/onarım randevu yazısı müşteri yetkilisine değil, dosyadaki irtibata gider. */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type HasarRandevuAliciInput = {
  siteContactName?: string | null;
  siteContactPhone?: string | null;
  siteContactEmail?: string | null;
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

export type HasarRandevuMailAlici = {
  email: string;
  name: string;
};

/** Tespit planı maili yalnız irtibat e-postasına gider; yoksa gitmez. */
export function hasarRandevuMailAlici(
  input: HasarRandevuAliciInput | null | undefined,
): HasarRandevuMailAlici | null {
  const email = trimText(input?.siteContactEmail).toLowerCase();
  if (!email || !EMAIL_RE.test(email)) return null;
  const name = trimText(input?.siteContactName);
  return { email, name };
}
