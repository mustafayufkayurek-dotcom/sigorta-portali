import {
  ACIL_YARDIM_ASSISTANT_CUSTOMER_SUB_TYPE,
  showsAcilYardimCustomerScope,
  type OperationAreaCode,
} from '@/app/panel/kullanicilar/_lib/user-invite-config';
import { isOfficeStaffRole } from '@/hooks/usePanelRole';
import { cardNotesToFormEntries } from '@/utils/card-notes';
import { toTitleCaseTR } from '@/utils/text-helpers';

export type CustomerType = 'individual' | 'corporate';

export type CustomerSubType =
  | 'insured'
  | 'private_customer'
  | 'eksper'
  | 'sigorta_sirketi'
  | 'eksper_firmasi'
  | 'asistan_firmasi'
  | '';

/** Kurumsal solda, bireysel sağda */
export const CUSTOMER_TYPE_OPTIONS: { val: CustomerType; label: string; emoji: string }[] = [
  { val: 'corporate', label: 'Kurumsal', emoji: '🏢' },
  { val: 'individual', label: 'Bireysel', emoji: '👤' },
];

export type CustomerSubTypeDef = {
  value: string;
  label: string;
  forType: 'individual' | 'corporate' | 'both';
  color: 'orange' | 'green' | 'purple' | 'blue' | 'gray';
};

export const DEFAULT_CUSTOMER_SUB_TYPES: CustomerSubTypeDef[] = [
  { value: 'sigorta_sirketi', label: 'Sigorta Şirketi', forType: 'corporate', color: 'blue' },
  { value: 'broker_firmasi', label: 'Broker Firması', forType: 'corporate', color: 'gray' },
  { value: 'asistan_firmasi', label: 'Asistan Firması', forType: 'corporate', color: 'orange' },
  { value: 'eksper_firmasi', label: 'Eksper Firması', forType: 'corporate', color: 'purple' },
  { value: 'insured', label: 'Sigortalı', forType: 'both', color: 'orange' },
  { value: 'private_customer', label: 'Özel Müşteri', forType: 'individual', color: 'green' },
];

/** Eski kayıtlar için — yeni kayıtta seçilemez */
const LEGACY_SUB_TYPE_LABELS: Record<string, string> = {
  eksper: 'Eksper',
};

const SUB_TYPE_LABELS: Record<string, string> = {
  ...Object.fromEntries(DEFAULT_CUSTOMER_SUB_TYPES.map((t) => [t.value, t.label])),
  ...LEGACY_SUB_TYPE_LABELS,
};

const CORPORATE_ONLY_SUB_TYPES = new Set([
  'sigorta_sirketi',
  'broker_firmasi',
  'asistan_firmasi',
  'eksper_firmasi',
]);

/** Kayıt varsa o durur. Boşsa sekme yapısı kaybolmasın diye varsayılan tipler. */
export function mergeCustomerSubTypes(stored: CustomerSubTypeDef[]): CustomerSubTypeDef[] {
  const clean = stored.filter((row) => row?.value && row.value !== 'eksper');
  if (clean.length === 0) return DEFAULT_CUSTOMER_SUB_TYPES.filter((t) => t.value !== 'eksper');
  return clean;
}

export function customerSubTypesForPicker(
  subTypes: CustomerSubTypeDef[],
  customerType: CustomerType,
): CustomerSubTypeDef[] {
  return subTypes.filter((t) => {
    if (t.value === 'eksper') return false;
    if (customerType === 'individual' && CORPORATE_ONLY_SUB_TYPES.has(t.value)) return false;
    return t.forType === customerType || t.forType === 'both';
  });
}

/** Hasar-only dosya sorumlusu (office_staff) acil yardım müşteri tiplerini görmemeli */
export function filterCustomerSubTypesForPanelUser(
  subTypes: CustomerSubTypeDef[],
  roleCode: string,
  operationArea: OperationAreaCode,
): CustomerSubTypeDef[] {
  if (isOfficeStaffRole(roleCode) && !showsAcilYardimCustomerScope(operationArea)) {
    return subTypes.filter((t) => t.value !== ACIL_YARDIM_ASSISTANT_CUSTOMER_SUB_TYPE);
  }
  return subTypes;
}

/** Alt tip seçildiğinde form altında gösterilen kısa yönlendirme metni */
const SUB_TYPE_HINTS: Record<string, string> = {
  sigorta_sirketi: 'Sigorta şirketi bilgilerini giriniz. Branş seçimini aşağıdan tamamlayın.',
  broker_firmasi: 'Broker firması bilgilerini giriniz.',
  asistan_firmasi: 'Asistan firması bilgilerini giriniz.',
  eksper_firmasi: 'Eksper firması bilgilerini giriniz.',
  eksper: 'Eski eksper kaydı — yeni tanımlar için Eksper Firması kullanın.',
  insured: 'Sigortalı müşteri bilgilerini giriniz.',
  private_customer: 'Özel müşteri bilgilerini giriniz.',
};

export function customerSubTypeLabel(subType: string | null | undefined): string | null {
  if (!subType) return null;
  return SUB_TYPE_LABELS[subType] ?? null;
}

export function customerSubTypeHint(subType: string | null | undefined): string | null {
  if (!subType) return null;
  return SUB_TYPE_HINTS[subType] ?? null;
}

/** API entityType ↔ UI customerType */
export function resolveCustomerType(c: {
  customerType?: string | null;
  entityType?: string | null;
  type?: string | null;
  companyName?: string | null;
  taxNumber?: string | null;
}): CustomerType {
  const entity = String(c.entityType ?? '').toLowerCase();
  if (entity === 'corporate' || entity === 'individual') {
    return entity;
  }
  const customerType = String(c.customerType ?? '').toLowerCase();
  if (customerType === 'corporate' || customerType === 'individual') {
    return customerType;
  }
  const legacyType = String(c.type ?? '').toLowerCase();
  if (legacyType === 'corporate' || legacyType === 'individual') {
    return legacyType;
  }
  if (c.companyName?.trim() || c.taxNumber?.trim()) return 'corporate';
  return 'individual';
}

export function customerDisplayName(c: {
  shortName?: string | null;
  companyName?: string | null;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}): string {
  const short = c.shortName?.trim();
  if (short) return short;
  const company = c.companyName?.trim();
  if (company) return company;
  const personal =
    c.fullName?.trim()
    || `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim();
  return personal || '—';
}

export function normalizeCustomerRow<T extends Record<string, unknown>>(
  c: T,
): T & { customerType: CustomerType; entityType: CustomerType } {
  const customerType = resolveCustomerType(c as Parameters<typeof resolveCustomerType>[0]);
  return { ...c, customerType, entityType: customerType };
}

export function customerTypeBadgeLabel(customerType: CustomerType): string {
  return customerType === 'corporate' ? 'Kurumsal' : 'Bireysel';
}

export function subTypeActiveClass(color: CustomerSubTypeDef['color']): string {
  switch (color) {
    case 'orange': return 'bg-orange-500 text-white border-orange-500';
    case 'green': return 'bg-green-600 text-white border-green-600';
    case 'purple': return 'bg-purple-600 text-white border-purple-600';
    case 'blue': return 'bg-brand-600 text-white border-brand-600';
    default: return 'bg-slate-600 text-white border-slate-600';
  }
}

/** Uluslararası (+90…) ve yerel (0…) formatları destekler */
export function customerPhoneValidationError(
  phone: string,
  phoneType: 'gsm' | 'landline' = 'gsm',
): string | null {
  if (!phone.trim()) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('90')) {
    const localLen = digits.length - 2;
    if (localLen > 0 && localLen < 10) {
      return `Telefon numarası eksik (şu an ${localLen} hane)`;
    }
    return null;
  }
  if (digits.length > 0 && digits.length < 10) {
    return `Telefon numarası çok kısa (şu an ${digits.length} hane)`;
  }
  if (digits.length === 11 && phoneType === 'gsm' && !digits.startsWith('0')) {
    return 'Telefon numarası 0 ile başlamalıdır';
  }
  return null;
}

/** Müşteri formu 4. sekme — menüdeki bağımsız CRM modülü ile karışmasın diye */
export const CUSTOMER_FORM_SECTIONS = [
  'Müşteri Bilgileri',
  'Yetkili & İletişim',
  'Adres',
  'İlişki Özeti',
] as const;

export const CUSTOMER_RELATION_SECTION_TITLE = 'İlişki Özeti';

export const CUSTOMER_RELATION_SECTION_HINT =
  'Numaralı notlar müşteri kartında kalıcı olarak görünür. Her not için kimlerin göreceğini seçin.';

/** Adres serbest metin alanları — Title Case (blur beklemeden özet/kayıt/geocode için) */
export function normalizeCustomerAddressFields(form: {
  neighborhood?: string;
  streetName?: string;
  address?: string;
}): { neighborhood: string; streetName: string; address: string } {
  const norm = (v?: string) => (v?.trim() ? toTitleCaseTR(v.trim()) : (v ?? ''));
  return {
    neighborhood: norm(form.neighborhood),
    streetName: norm(form.streetName),
    address: norm(form.address),
  };
}

export function mapCustomerContactsToForm(contacts: Array<{
  id?: string;
  name?: string;
  role?: string | null;
  phone?: string | null;
  email?: string | null;
}> = []) {
  if (!contacts.length) {
    return [{ firstName: '', lastName: '', role: '', phone: '', phoneType: 'gsm' as const, extensionNo: '', email: '' }];
  }
  return contacts.map((contact) => {
    const parts = String(contact.name ?? '').trim().split(/\s+/);
    const firstName = parts[0] ?? '';
    const lastName = parts.slice(1).join(' ');
    return {
      id: contact.id,
      firstName,
      lastName,
      role: contact.role ?? '',
      phone: contact.phone ?? '',
      phoneType: 'gsm' as const,
      extensionNo: '',
      email: contact.email ?? '',
    };
  });
}

export function mapCustomerContactInfosToForm(contactInfos: Array<{
  id?: string;
  type?: string;
  value?: string;
  label?: string;
}> = []) {
  if (!contactInfos.length) {
    return [{ type: 'phone', value: '', label: 'general' }];
  }
  return contactInfos.map((item) => ({
    id: item.id,
    type: item.type ?? 'phone',
    value: item.value ?? '',
    label: item.label ?? 'general',
  }));
}

/** Liste/detay rozeti — API hasar|HASAR|acil_yardim karışıklığını tek dilde çözer */
export function isHasarCustomerServiceType(serviceType?: string | null): boolean {
  const v = String(serviceType ?? '').trim().toLowerCase().replace(/-/g, '_');
  return v === 'hasar' || v === 'hasar_onarim';
}

export function isAcilCustomerServiceType(serviceType?: string | null): boolean {
  const v = String(serviceType ?? '').trim().toLowerCase().replace(/-/g, '_');
  return v === 'acil_yardim' || v === 'acil' || v === 'acil_yardım';
}

export function customerServiceTypeLabel(serviceType?: string | null): string {
  if (!serviceType) return '';
  if (isHasarCustomerServiceType(serviceType)) return 'Hasar Onarım';
  if (isAcilCustomerServiceType(serviceType)) return 'Acil Yardım';
  return String(serviceType);
}

/** API müşteri kaydı → tam müşteri formu (düzenleme) */
export function mapCustomerRecordToForm(
  customer: Record<string, unknown>,
  provinces: Array<{ code: string; name: string }>,
) {
  const entityType = (customer.entityType ?? customer.customerType ?? 'individual') as 'individual' | 'corporate';
  const province = provinces.find((p) => p.name === customer.city);
  const serviceBranches = Array.isArray(customer.serviceBranches)
    ? customer.serviceBranches.filter((v): v is string => typeof v === 'string')
    : [];
  const tags = Array.isArray(customer.tags)
    ? customer.tags.filter((t): t is string => typeof t === 'string')
    : [];
  const subType = String(customer.subType ?? '') as CustomerSubType;
  const serviceTypeRaw = String(customer.serviceType ?? '').toLowerCase();
  const serviceType = serviceTypeRaw === 'acil_yardim' || serviceTypeRaw === 'hasar'
    ? serviceTypeRaw
    : subType === 'asistan_firmasi'
      ? 'acil_yardim'
      : subType === 'sigorta_sirketi'
        ? 'hasar'
        : '' as '' | 'hasar' | 'acil_yardim';

  return {
    customerType: entityType,
    subType,
    firstName: String(customer.firstName ?? ''),
    lastName: String(customer.lastName ?? ''),
    companyName: String(customer.companyName ?? ''),
    shortName: String(customer.shortName ?? ''),
    taxNumber: String(customer.taxNumber ?? ''),
    taxOffice: String(customer.taxOffice ?? ''),
    identityNo: String(customer.identityNo ?? ''),
    contactFirstName: String(customer.contactFirstName ?? ''),
    contactLastName: String(customer.contactLastName ?? ''),
    phone: String(customer.phone ?? ''),
    email: String(customer.email ?? ''),
    phoneType: 'gsm' as const,
    extensionNo: '',
    cityCode: province?.code ?? '',
    city: String(customer.city ?? ''),
    district: String(customer.district ?? ''),
    neighborhood: String(customer.neighborhood ?? ''),
    streetName: String(customer.streetName ?? ''),
    buildingNo: String(customer.buildingNo ?? ''),
    doorNo: String(customer.doorNo ?? ''),
    address: String(customer.address ?? ''),
    source: String(customer.source ?? ''),
    satisfactionScore: customer.satisfactionScore
      ? String(customer.satisfactionScore) as '1' | '2' | '3' | '4' | '5'
      : '' as '' | '1' | '2' | '3' | '4' | '5',
    followUpDate: customer.followUpDate
      ? new Date(String(customer.followUpDate)).toISOString().slice(0, 10)
      : '',
    tags,
    cardNotes: cardNotesToFormEntries(String(customer.notes ?? '')),
    serviceType,
    serviceBranches,
    privateServiceType: '',
  };
}

export function formatCustomerUpdatedMeta(customer: {
  updatedAt?: string | Date | null;
  updatedByUser?: { firstName?: string | null; lastName?: string | null } | null;
}): string | null {
  if (!customer.updatedAt) return null;
  const when = new Date(customer.updatedAt).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const who = customer.updatedByUser
    ? `${customer.updatedByUser.firstName ?? ''} ${customer.updatedByUser.lastName ?? ''}`.trim()
    : '';
  return who ? `${who} — ${when}` : when;
}
