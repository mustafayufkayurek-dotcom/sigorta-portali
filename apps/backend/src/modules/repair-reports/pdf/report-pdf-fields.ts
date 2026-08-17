/**
 * Hasar Tespit Raporu PDF — DATA FIELD ISOLATION (SSOT).
 * Şablon bu accessor’ları kullanır; ekranda / başka yerde tekrar mapping yok.
 *
 * Sigortalı adı ≠ eksper ofisi ≠ sigorta şirketi ≠ dosya no ≠ tedarikçi.
 */

export type PdfClaimCustomer = {
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
  entityType?: string | null;
  type?: string | null;
  subType?: string | null;
  phone?: string | null;
  contacts?: Array<{ phone?: string | null }> | null;
};

export type PdfPropertyAddress = {
  addressLine?: string | null;
  neighborhood?: string | null;
  district?: string | null;
  city?: string | null;
};

export type PdfAssignedAdjuster = {
  firstName?: string | null;
  lastName?: string | null;
  adjuster?: { name?: string | null; company?: string | null } | null;
};

export type PdfClaimFileSource = {
  fileNo?: string | null;
  claimNo?: string | null;
  lossType?: string | null;
  insuredName?: string | null;
  insuredPhone?: string | null;
  commercialTitle?: string | null;
  insuranceCompany?: { name?: string | null } | null;
  customer?: PdfClaimCustomer | null;
  propertyAddress?: PdfPropertyAddress | null;
  claimSubject?: { name?: string | null } | null;
  departmentFileSubject?: { name?: string | null } | null;
  assignedAdjuster?: PdfAssignedAdjuster | null;
};

export type PdfExpertOfficeSource = {
  companyName?: string | null;
  fullName?: string | null;
};

export type PdfReportIdentitySource = {
  reporterName?: string | null;
  expertOffice?: PdfExpertOfficeSource | null;
  claimFile?: PdfClaimFileSource | null;
  damageTypes?: Array<{ damageTypeName?: string | null }> | null;
  findingsText?: string | null;
};

export type PdfReportIdentity = {
  fileNo: string;
  insuranceCompany: string;
  insuredName: string;
  insuredPhone: string;
  insuredAddress: string;
  expertCompany: string;
  claimType: string;
  damageCause: string;
  reporterName: string;
  showReporter: boolean;
  findingsText: string;
};

const EXPERT_SUB_TYPES = new Set(['eksper_firmasi', 'eksper']);
const NON_INSURED_SUB_TYPES = new Set([
  'eksper_firmasi',
  'eksper',
  'asistan_firmasi',
  'sigorta_sirketi',
  'broker_firmasi',
]);

function trimOrEmpty(v?: string | null): string {
  return typeof v === 'string' ? v.trim() : '';
}

function isPdfPlaceholder(v?: string | null): boolean {
  const t = trimOrEmpty(v).toLocaleLowerCase('tr');
  return !t || t === '—' || t === '-' || t === 'belirtilmemiş' || t === 'belirtilmemis';
}

function meaningfulText(v?: string | null): string {
  return isPdfPlaceholder(v) ? '' : trimOrEmpty(v);
}

function isCorporateCustomer(customer?: PdfClaimCustomer | null): boolean {
  if (!customer) return false;
  const sub = trimOrEmpty(customer.subType).toLowerCase();
  if (EXPERT_SUB_TYPES.has(sub)) return true;
  if (NON_INSURED_SUB_TYPES.has(sub)) return true;
  const kind = trimOrEmpty(customer.entityType || customer.type).toLowerCase();
  return kind === 'corporate';
}

function individualCustomerName(customer?: PdfClaimCustomer | null): string {
  if (!customer || isCorporateCustomer(customer)) return '';
  const composed = [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim();
  return composed || trimOrEmpty(customer.fullName);
}

/** Dosya No — yalnız fileNo / claimNo; sigorta / eksper / sigortalı fallback yok. */
export function resolvePdfFileNo(src: PdfClaimFileSource | null | undefined): string {
  const fileNo = trimOrEmpty(src?.fileNo);
  if (fileNo) return fileNo;
  return trimOrEmpty(src?.claimNo);
}

/** Sigorta şirketi — yalnız insuranceCompany.name */
export function resolvePdfInsuranceCompany(src: PdfClaimFileSource | null | undefined): string {
  return trimOrEmpty(src?.insuranceCompany?.name);
}

/**
 * Sigortalı ad soyad — yalnız insuredName, yoksa bireysel müşteri adı.
 * Eksper ofisi / kurumsal müşteri / ihbarı yapan / inspector yazılamaz.
 */
export function resolvePdfInsuredName(src: PdfClaimFileSource | null | undefined): string {
  const insured = trimOrEmpty(src?.insuredName);
  if (insured) return insured;
  return individualCustomerName(src?.customer);
}

/** Sigortalı telefon — dosyadaki telefon; yoksa müşteri kartı. */
export function resolvePdfInsuredPhone(src: PdfClaimFileSource | null | undefined): string {
  const fromFile = trimOrEmpty(src?.insuredPhone);
  if (fromFile) return fromFile;
  const fromCustomer = trimOrEmpty(src?.customer?.phone);
  if (fromCustomer) return fromCustomer;
  const fromContact = (src?.customer?.contacts ?? [])
    .map((c) => trimOrEmpty(c.phone))
    .find(Boolean);
  return fromContact ?? '';
}

function addressAlreadyHas(parts: string[], piece: string): boolean {
  const p = piece.toLocaleLowerCase('tr-TR');
  if (!p) return true;
  return parts.some((part) => part.toLocaleLowerCase('tr-TR').includes(p));
}

/** Sigortalı adres — yalnız propertyAddress; kişi/firma adı karışmaz. İl/ilçe sokakta varsa tekrar yazılmaz. */
export function resolvePdfInsuredAddress(src: PdfClaimFileSource | null | undefined): string {
  const addr = src?.propertyAddress;
  if (!addr) return '';
  const street = trimOrEmpty(addr.addressLine);
  const neighborhood = trimOrEmpty(addr.neighborhood);
  const district = trimOrEmpty(addr.district);
  const city = trimOrEmpty(addr.city);
  const parts: string[] = [];
  if (street) parts.push(street);
  if (neighborhood && neighborhood !== district && !addressAlreadyHas(parts, neighborhood)) {
    parts.push(neighborhood);
  }
  if (district && !addressAlreadyHas(parts, district)) parts.push(district);
  if (city && city !== district && !addressAlreadyHas(parts, city)) parts.push(city);
  return parts.join(', ');
}

/**
 * Eksper ofisi — expertOffice, yoksa ekspertiz müşteri kartı, yoksa atanmış eksper.
 * Sigortalı adı / dosya sorumlusu yazılmaz.
 */
export function resolvePdfExpertCompany(
  office?: PdfExpertOfficeSource | null,
  claim?: PdfClaimFileSource | null,
): string {
  const fromOffice = trimOrEmpty(office?.companyName) || trimOrEmpty(office?.fullName);
  if (fromOffice) return fromOffice;
  const customer = claim?.customer;
  const sub = trimOrEmpty(customer?.subType).toLowerCase();
  if (customer && EXPERT_SUB_TYPES.has(sub)) {
    const fromFirm = trimOrEmpty(customer.companyName) || trimOrEmpty(customer.fullName);
    if (fromFirm) return fromFirm;
  }
  const adj = claim?.assignedAdjuster;
  const fromAdjusterFirm = trimOrEmpty(adj?.adjuster?.company) || trimOrEmpty(adj?.adjuster?.name);
  if (fromAdjusterFirm) return fromAdjusterFirm;
  return [adj?.firstName, adj?.lastName].filter(Boolean).join(' ').trim();
}

/** Dosya konusu — kayıtlı konu; «Belirtilmemiş» yer tutucu sayılmaz. */
export function resolvePdfClaimType(
  src: PdfClaimFileSource | null | undefined,
  damageTypes?: Array<{ damageTypeName?: string | null }> | null,
): string {
  return (
    meaningfulText(src?.claimSubject?.name)
    || meaningfulText(src?.departmentFileSubject?.name)
    || meaningfulText(src?.lossType)
    || (damageTypes ?? [])
      .map((dt) => meaningfulText(dt.damageTypeName))
      .filter(Boolean)
      .join(', ')
  );
}

/** Hasar sebebi — rapor damageTypes; sigortalı / adres karışmaz. */
export function resolvePdfDamageCause(
  damageTypes?: Array<{ damageTypeName?: string | null }> | null,
): string {
  const names = (damageTypes ?? [])
    .map((dt) => trimOrEmpty(dt.damageTypeName))
    .filter(Boolean);
  return names.join(', ');
}

/** Cümle başı büyük harf (TR). Kullanıcı küçük yazdıysa PDF/kayıtta düzeltilir. */
export function capitalizeSentencesTR(text: string): string {
  const t = text.trim();
  if (!t) return '';
  return t.replace(/(^|[.!?…]\s+)(\p{L})/gu, (_full, prefix: string, letter: string) => {
    return `${prefix}${letter.toLocaleUpperCase('tr')}`;
  });
}

export function resolvePdfFindingsText(findingsText?: string | null): string {
  let t = trimOrEmpty(findingsText);
  const lead = /^riziko\s+adreste\s+yapılan\s+incelemeler\s+sonucunda[;:,]?\s*/iu;
  while (lead.test(t)) {
    t = t.replace(lead, '').trim();
  }
  return capitalizeSentencesTR(t);
}

/** Fotoğraf eki: her satır 3 görsel; tablo satırı sayfa içinde bölünmez. */
export function chunkPhotoRows<T>(items: T[], perRow = 3): T[][] {
  const rows: T[][] = [];
  const n = Math.max(1, perRow);
  for (let i = 0; i < items.length; i += n) {
    rows.push(items.slice(i, i + n));
  }
  return rows;
}

/**
 * İhbarı yapan, sigortalıdan farklıysa ayrı gösterilir.
 * Sigortalı alanına yazılmaz.
 */
export function resolvePdfReporterDisplay(
  reporterName?: string | null,
  insuredName?: string,
): { reporterName: string; showReporter: boolean } {
  const reporter = trimOrEmpty(reporterName);
  const insured = trimOrEmpty(insuredName);
  if (!reporter) return { reporterName: '', showReporter: false };
  if (insured && reporter.toLocaleLowerCase('tr') === insured.toLocaleLowerCase('tr')) {
    return { reporterName: reporter, showReporter: false };
  }
  return { reporterName: reporter, showReporter: true };
}

export function mapRepairReportPdfIdentity(src: PdfReportIdentitySource): PdfReportIdentity {
  const cf = src.claimFile;
  const insuredName = resolvePdfInsuredName(cf);
  const reporter = resolvePdfReporterDisplay(src.reporterName, insuredName);
  return {
    fileNo: resolvePdfFileNo(cf),
    insuranceCompany: resolvePdfInsuranceCompany(cf),
    insuredName,
    insuredPhone: resolvePdfInsuredPhone(cf),
    insuredAddress: resolvePdfInsuredAddress(cf),
    expertCompany: resolvePdfExpertCompany(src.expertOffice, cf),
    claimType: resolvePdfClaimType(cf, src.damageTypes),
    damageCause: resolvePdfDamageCause(src.damageTypes),
    reporterName: reporter.reporterName,
    showReporter: reporter.showReporter,
    findingsText: resolvePdfFindingsText(src.findingsText),
  };
}

export function assertPdfIdentityFieldsIsolated(src: PdfReportIdentitySource): PdfReportIdentity {
  return mapRepairReportPdfIdentity(src);
}

export const PDF_FINDINGS_SECTION_TITLE = 'Tespit Bulguları';
export const PDF_FINDINGS_LEAD = 'Riziko adreste yapılan incelemeler sonucunda;';
export const PDF_GRAND_TOTAL_LABEL = 'Rapor Genel Toplam';
export const PDF_BINA_TOTAL_LABEL = 'Bina Hasarı Toplamı';
export const PDF_ESYA_TOTAL_LABEL = 'Eşya Hasarı Toplamı';
export const PDF_DEMIRBAS_TOTAL_LABEL = 'Demirbaş Hasarı Toplamı';

export type PdfExternalColWidths = {
  group: number;
  mahal: number;
  job: number;
  desc: number;
  qty: number;
  unit: number;
  price: number;
  amount: number;
};

/**
 * Müşteri tablosu: kısa iş tanımı → açıklama genişler.
 * Sayı kolonları sabit; mahal içeriğe göre daralır.
 */
export function allocateExternalColWidths(
  items: Array<{
    jobDescription?: string | null;
    description?: string | null;
    location?: string | null;
  }>,
): PdfExternalColWidths {
  const longest = (vals: Array<string | null | undefined>) =>
    vals.reduce((max, v) => Math.max(max, trimOrEmpty(v).length), 0);

  const maxJob = longest(items.map((i) => i.jobDescription));
  const maxDesc = longest(items.map((i) => i.description));
  const maxMahal = longest(items.map((i) => i.location));

  const group = 11;
  const mahal = maxMahal <= 10 ? 8 : maxMahal <= 18 ? 10 : 12;
  const qty = 5;
  const unit = 6;
  const price = 8;
  const amount = 13;
  const flex = 100 - group - mahal - qty - unit - price - amount;
  const jobWeight = Math.max(maxJob, 8);
  const descWeight = Math.max(maxDesc, 6);
  const jobMin = 14;
  const jobMax = Math.min(30, flex - 16);
  let job = Math.round((flex * jobWeight) / (jobWeight + descWeight));
  job = Math.min(jobMax, Math.max(jobMin, job));
  const desc = flex - job;
  return { group, mahal, job, desc, qty, unit, price, amount };
}

export function pdfCategoryTotalLabel(category: string): string {
  if (category === 'esya') return PDF_ESYA_TOTAL_LABEL;
  if (category === 'demirbas') return PDF_DEMIRBAS_TOTAL_LABEL;
  return PDF_BINA_TOTAL_LABEL;
}
