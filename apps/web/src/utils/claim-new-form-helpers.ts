/** Yeni hasar dosyası — sessiz kullanıcı tercihleri */

export const CLAIM_NEW_PREFS_KEY = 'meridyen:claim-new-prefs';

export type ClaimNewPrefs = {
  insuranceCompanyId?: string;
  lossType?: string;
};

export function todayTrDateDisplay(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

export function loadClaimNewPrefs(): ClaimNewPrefs {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(CLAIM_NEW_PREFS_KEY);
    return raw ? (JSON.parse(raw) as ClaimNewPrefs) : {};
  } catch {
    return {};
  }
}

export function saveClaimNewPrefs(prefs: ClaimNewPrefs): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CLAIM_NEW_PREFS_KEY, JSON.stringify(prefs));
  } catch { /* quota */ }
}

/** Açık Yeni Dosya. Müşteri kartına gidince sayfa kapanır; yazılanlar bu oturumda durur. */
export const YENI_DOSYA_TASLAK_KEY = 'meridyen:yeni-dosya-taslak';

export type YeniDosyaTaslakCard = {
  id: string;
  subType?: string | null;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
  shortName?: string | null;
  identityNo?: string | null;
  taxNumber?: string | null;
  phone?: string | null;
  insuranceCompanyId?: string | null;
};

export type YeniDosyaReturnSlot = 'source' | 'private' | 'agency' | 'broker' | 'expert';

export type YeniDosyaTaslak = {
  customerSource: string;
  serviceKind: string;
  consultancyServiceTypeId: string;
  insuranceCompanyId: string;
  channelAgencyCustomerId: string;
  channelBrokerCustomerId: string;
  channelExpertCustomerId: string;
  fileNo: string;
  lossType: string;
  priority: string;
  notificationDate: string;
  insuredName: string;
  description: string;
  assignedOfficeUserId: string;
  siteContactName: string;
  siteContactPhone: string;
  siteContactEmail: string;
  sourceContactId: string;
  customerSearch: string;
  cityCode: string;
  city: string;
  district: string;
  openAddress: string;
  selectedCustomer: YeniDosyaTaslakCard | null;
  privateCustomer: YeniDosyaTaslakCard | null;
  returnSlot: YeniDosyaReturnSlot | '';
  mailApproval?: string[];
  mailCorrespondence?: string[];
};

export function loadYeniDosyaTaslak(): YeniDosyaTaslak | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(YENI_DOSYA_TASLAK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as YeniDosyaTaslak;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveYeniDosyaTaslak(draft: YeniDosyaTaslak): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(YENI_DOSYA_TASLAK_KEY, JSON.stringify(draft));
  } catch { /* quota */ }
}

export function clearYeniDosyaTaslak(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(YENI_DOSYA_TASLAK_KEY);
  } catch { /* ignore */ }
}
