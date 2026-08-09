import { toTitleCaseTR } from './text-helpers';
import { customerPhoneValidationError } from '@/utils/customer-form-helpers';
import {
  documentTypeMatchesVendorCategory,
  filterDocumentTypesForVendorCategory,
  type DocumentTypeScopeRow,
} from './document-type-scope';

export type VendorCategory = 'hasar' | 'acil' | 'her_ikisi';

export const VENDOR_CATEGORIES: { value: VendorCategory; label: string }[] = [
  { value: 'hasar', label: 'Hasar Onarım' },
  { value: 'acil', label: 'Acil Yardım' },
  { value: 'her_ikisi', label: 'Hasar + Acil Yardım' },
];

export type VendorDocumentTypeRow = DocumentTypeScopeRow & {
  /** Ayarlar → Evrak Türleri'nde seçilen departman(lar) — geriye dönük */
  departmentIds?: unknown;
  serviceTypeIds?: unknown;
};

export type DepartmentRef = { id: string; code: string };

export function buildDepartmentCodeMap(departments: DepartmentRef[]): Map<string, string> {
  return new Map(departments.map((d) => [d.id, d.code]));
}

/** Evrak türü seçiminde "Diğer" + manuel açıklama */
export const VENDOR_DOC_OTHER_SELECT = '__other__';

export function isOtherDocumentTypeName(name: string): boolean {
  const n = name.trim().toLowerCase();
  return n === 'diğer' || n === 'diger';
}

export const HIZMET_KOLU_OTHER_KEY = '__other__';

export function isVendorTypeOther(type: string): boolean {
  return type.trim().toLowerCase() === 'diğer' || type.trim().toLowerCase() === 'diger';
}

/** Tedarikçi türü görüntüleme — Türkçe yazım kuralı (hizmet → Hizmet) */
export function formatVendorTypeLabel(type: string | null | undefined): string | null {
  if (!type?.trim()) return null;
  return toTitleCaseTR(type.trim());
}

/**
 * Evrak türü listesini tedarikçi hizmet kategorisine göre filtreler.
 * Birincil kaynak: Ayarlar → Evrak Türleri (hizmet türü / serviceBranchTypes).
 */
export function documentTypeMatchesCategory(
  doc: VendorDocumentTypeRow,
  category: VendorCategory,
  deptCodeById: Map<string, string> = new Map(),
): boolean {
  return documentTypeMatchesVendorCategory(doc, category, deptCodeById);
}

/** Kategoriye göre evrak listesi; alfabetik sıralı */
export function filterDocumentTypesForCategory(
  documentTypes: VendorDocumentTypeRow[],
  category: VendorCategory,
  deptCodeById: Map<string, string> = new Map(),
): VendorDocumentTypeRow[] {
  return filterDocumentTypesForVendorCategory(documentTypes, category, deptCodeById);
}

/** "Diğer" evrak türü kaydı — kategori filtresine göre veya genel */
export function findOtherDocumentTypeId(
  documentTypes: VendorDocumentTypeRow[],
  category: VendorCategory,
  deptCodeById: Map<string, string> = new Map(),
): string | null {
  const scoped = filterDocumentTypesForCategory(documentTypes, category, deptCodeById);
  const inScope = scoped.find((dt) => isOtherDocumentTypeName(dt.name));
  if (inScope) return inScope.id;
  const global = documentTypes.find((dt) => isOtherDocumentTypeName(dt.name));
  return global?.id ?? null;
}

export function vendorCategoryShowsHasarKollari(category: VendorCategory): boolean {
  return category === 'hasar' || category === 'her_ikisi';
}

export function vendorCategoryShowsAcilKollari(category: VendorCategory): boolean {
  return category === 'acil' || category === 'her_ikisi';
}

/** Tedarikçi türüne göre faaliyet notu placeholder */
export function vendorTypeActivityPlaceholder(type: string): string {
  const t = type.trim().toLowerCase();
  if (t.includes('taşeron') || t.includes('taseron')) return 'Örn: Mobilyacı, Boyacı, Sıvacı...';
  if (t.includes('malzeme')) return 'Örn: Boya Malzemesi, Mobilya Yedek Parçası...';
  if (t.includes('lojistik')) return 'Örn: Eşya Taşıma, Nakliye...';
  if (t.includes('ekipman')) return 'Örn: İskele, Makine, Araç Kiralama...';
  if (t === 'diğer' || t === 'diger') return 'Tür ve faaliyet alanını yazın...';
  return 'Örn: Faaliyet alanını kısaca yazın...';
}

export type VendorTypeHizmetMode = 'taseron_grid' | 'malzeme_text' | 'lojistik_text' | 'ekipman_text' | 'custom_text';

function normalizeVendorTypeKey(type: string): string {
  return type
    .trim()
    .toLocaleLowerCase('tr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i');
}

export function resolveVendorTypeHizmetMode(type: string): VendorTypeHizmetMode {
  const t = normalizeVendorTypeKey(type);
  if (t.includes('taseron')) return 'taseron_grid';
  if (t.includes('malzeme')) return 'malzeme_text';
  if (t.includes('lojistik')) return 'lojistik_text';
  if (t.includes('ekipman')) return 'ekipman_text';
  return 'custom_text';
}

export function vendorTypeModeBadge(mode: VendorTypeHizmetMode): string {
  switch (mode) {
    case 'taseron_grid': return 'Taşeron — hizmet kolu listesi';
    case 'malzeme_text': return 'Malzeme — ürün grubu girişi';
    case 'lojistik_text': return 'Lojistik — faaliyet girişi';
    case 'ekipman_text': return 'Ekipman — faaliyet girişi';
    default: return 'Özel tür — faaliyet girişi';
  }
}

export function vendorTypeActivityLabel(mode: VendorTypeHizmetMode, typeName: string): string {
  switch (mode) {
    case 'malzeme_text': return 'Tedarik ettiği malzeme / ürün grubu';
    case 'lojistik_text': return 'Lojistik faaliyet alanı';
    case 'ekipman_text': return 'Ekipman / hizmet alanı';
    case 'taseron_grid': return `${typeName} — ek faaliyet notu`;
    default: return `${typeName} — faaliyet açıklaması`;
  }
}

export function vendorTypeQuickPicks(mode: VendorTypeHizmetMode): string[] {
  switch (mode) {
    case 'malzeme_text':
      return ['Boya Malzemesi', 'Yalıtım Malzemesi', 'Tesisat Malzemesi', 'Mobilya Yedek Parça', 'Cam / Doğrama', 'Elektrik Malzemesi'];
    case 'lojistik_text':
      return ['Eşya Taşıma', 'Nakliye', 'Depolama', 'Acil Sevkiyat'];
    case 'ekipman_text':
      return ['İskele', 'Vinç / Lift', 'Jeneratör', 'Temizlik Makinesi', 'Kiralık Araç'];
    default:
      return [];
  }
}

export function vendorTypeShowsWorkGroupGrid(mode: VendorTypeHizmetMode): boolean {
  return mode === 'taseron_grid';
}

export function vendorTypeSectionHint(mode: VendorTypeHizmetMode, typeName: string): string {
  switch (mode) {
    case 'taseron_grid':
      return `${typeName} için hasar onarım hizmet kollarından seçim yapın veya "Diğer" ile yazın.`;
    case 'malzeme_text':
      return `${typeName} için usta listesi gerekmez; tedarik ettiği malzeme gruplarından bir veya birkaçını seçin veya "Diğer" ile yazın.`;
    case 'lojistik_text':
      return `${typeName} için taşıma / lojistik faaliyetini kısaca belirtin.`;
    case 'ekipman_text':
      return `${typeName} için sunduğu ekipman veya hizmeti kısaca belirtin.`;
    default:
      return `${typeName} için faaliyet alanını kısaca yazın.`;
  }
}

export function vendorCategorySummary(category: VendorCategory): {
  title: string;
  hint: string;
  contractLabel: string;
} {
  switch (category) {
    case 'acil':
      return {
        title: 'Acil Yardım kapsamı',
        hint: 'Acil yardım anlaşması ve acil departmanına tanımlı evrak türleri geçerlidir.',
        contractLabel: 'Acil Yardım Anlaşması',
      };
    case 'her_ikisi':
      return {
        title: 'Hasar + Acil Yardım kapsamı',
        hint: 'Her iki departmanın evrak türleri ve birleşik sözleşme bilgileri geçerlidir.',
        contractLabel: 'Sözleşme Bilgileri',
      };
    default:
      return {
        title: 'Hasar Onarım kapsamı',
        hint: 'Hasar onarım / sovtaj departmanlarına tanımlı evrak türleri ve hasar sözleşmesi geçerlidir.',
        contractLabel: 'Hasar Sözleşmesi',
      };
  }
}

export function formatVendorAddress(parts: {
  neighborhood?: string;
  streetName?: string;
  buildingNo?: string;
  doorNo?: string;
  district?: string;
  city?: string;
  address?: string;
}): string {
  const structured = [
    parts.neighborhood,
    parts.streetName,
    parts.buildingNo ? `No: ${parts.buildingNo}` : '',
    parts.doorNo ? `D: ${parts.doorNo}` : '',
    parts.district,
    parts.city,
  ].filter(Boolean);
  if (structured.length > 0) return structured.join(', ');
  return (parts.address ?? '').trim();
}

export function contractSectionMeta(category: VendorCategory) {
  switch (category) {
    case 'acil':
      return {
        title: 'Acil Yardım Anlaşması',
        hint: 'Acil yardım kapsamındaki anlaşma tarihlerini girin.',
      };
    case 'her_ikisi':
      return {
        title: 'Sözleşme Bilgileri',
        hint: 'Hasar ve acil yardım hizmetlerini kapsayan anlaşma tarihleri.',
      };
    default:
      return {
        title: 'Hasar Sözleşmesi',
        hint: 'Hasar onarım hizmet sözleşmesi başlangıç ve bitiş tarihleri.',
      };
  }
}

export function mapsNavigationUrls(lat: number, lng: number) {
  return {
    googleView: `https://www.google.com/maps?q=${lat},${lng}`,
    googleDirections: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    apple: `https://maps.apple.com/?daddr=${lat},${lng}`,
    yandexView: `https://yandex.com/maps/?pt=${lng},${lat}&z=16&l=map`,
    yandexDirections: `https://yandex.com/maps/?rtext=~${lat},${lng}&rtt=auto`,
  };
}

/** Tedarikçi ödeme kuralı: hasar dosyasındaki giden ödeme + dekont → tedarikçi Ödemeler/Ekstre */
export const VENDOR_FILE_PAYMENT_RECEIPT_RULE =
  'Her hasar dosyasında tedarikçiye yapılan ödeme dekontu yüklendiğinde kayıt ilgili tedarikçinin Ödemeler / Ekstre sekmesine yansır.';
export const VENDOR_RELATION_SECTION_TITLE = 'İlişki Özeti';

export const VENDOR_RELATION_SECTION_HINT =
  'Numaralı notlar tedarikçi kartında kalıcı olarak görünür. Müşteri portalları hariç iç ekibe açıktır.';

/** Tedarikçi formu sekme başlıkları */
export const VENDOR_FORM_SECTIONS = [
  'Temel Bilgiler',
  'Yetkili Kişiler',
  'Adres & Hizmet',
  'İlişki Özeti & Finans',
  'Evraklar',
] as const;

type ContactLike = {
  phone?: string;
  phoneType?: 'gsm' | 'landline';
  email?: string;
  isPrimary?: boolean;
};

type ContactInfoLike = {
  type?: string;
  value?: string;
};

/** Tedarikçi kaydında telefon — form, yetkili kişi veya contactInfos */
export function resolveVendorPrimaryPhone(
  formPhone: string,
  contacts: ContactLike[],
  contactInfos: ContactInfoLike[],
): string {
  const trimmed = formPhone?.trim();
  if (trimmed) return trimmed;

  const primaryContact = contacts.find((c) => c.isPrimary && c.phone?.trim());
  if (primaryContact?.phone?.trim()) return primaryContact.phone.trim();

  const anyContact = contacts.find((c) => c.phone?.trim());
  if (anyContact?.phone?.trim()) return anyContact.phone.trim();

  const infoPhone = contactInfos.find((ci) => ci.type === 'phone' && ci.value?.trim());
  if (infoPhone?.value?.trim()) return infoPhone.value.trim();

  return '';
}

export function resolveVendorPrimaryEmail(
  formEmail: string,
  contacts: ContactLike[],
  contactInfos: ContactInfoLike[],
): string {
  const trimmed = formEmail?.trim();
  if (trimmed) return trimmed;

  const primaryContact = contacts.find((c) => c.isPrimary && c.email?.trim());
  if (primaryContact?.email?.trim()) return primaryContact.email.trim();

  const anyContact = contacts.find((c) => c.email?.trim());
  if (anyContact?.email?.trim()) return anyContact.email.trim();

  const infoEmail = contactInfos.find((ci) => ci.type === 'email' && ci.value?.trim());
  if (infoEmail?.value?.trim()) return infoEmail.value.trim();

  return '';
}

export function vendorPhoneRequiredError(
  phone: string,
  phoneType: 'gsm' | 'landline' = 'gsm',
): string | null {
  if (!phone.trim()) return 'Telefon alanı zorunludur';
  return customerPhoneValidationError(phone, phoneType);
}
