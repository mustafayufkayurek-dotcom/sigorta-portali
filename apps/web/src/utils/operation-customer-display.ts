import {
  customerSubTypeLabel,
  resolveCustomerType,
} from '@/utils/customer-form-helpers';

export type OperationCustomerSource = {
  id?: string | null;
  shortName?: string | null;
  companyName?: string | null;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  entityType?: string | null;
  customerType?: string | null;
  type?: string | null;
  subType?: string | null;
} | null | undefined;

export type OperationInsuranceSource = {
  name?: string | null;
} | null | undefined;

export const OPERATION_CUSTOMER_UNDEFINED = 'Müşteri Tanımlanmamış';
/** Kart var, Kısa Ad boş — müşteri yok demek değildir. */
export const OPERATION_CUSTOMER_SHORT_UNSET = 'Kısa Ad Tanımlanmamış';

export function customerShortNameEditHref(customerId: string): string {
  return `/panel/musteriler?edit=${encodeURIComponent(customerId)}`;
}

/** Operasyon sütununda gösterilen iş müşteri alt tipleri — `insured` hariç. */
const OPERATION_CUSTOMER_SUB_TYPES = new Set([
  'sigorta_sirketi',
  'broker_firmasi',
  'asistan_firmasi',
  'eksper_firmasi',
  'eksper',
  'private_customer',
]);

/**
 * Dosyanın gerçek müşteri ilişkisi mi?
 * Sigortalı kaydı / boş bireysel bağ müşteri sayılmaz — tahmin yok.
 */
export function isOperationBusinessCustomer(
  customer: OperationCustomerSource,
): boolean {
  if (!customer) return false;
  const sub = String(customer.subType ?? '').trim().toLowerCase();
  if (sub === 'insured') return false;
  if (OPERATION_CUSTOMER_SUB_TYPES.has(sub)) return true;

  if (!sub) {
    const entity = resolveCustomerType(customer);
    return entity === 'corporate' && Boolean(customer.companyName?.trim());
  }

  return false;
}

/** Dosyanın bağlı müşteri kaydından tip etiketi — tahmin yok. */
export function resolveOperationCustomerTypeLabel(
  customer: OperationCustomerSource,
): string | null {
  if (!customer || !isOperationBusinessCustomer(customer)) return null;
  const sub = customerSubTypeLabel(customer.subType);
  if (sub) return sub;
  const entity = resolveCustomerType(customer);
  if (entity === 'corporate') return 'Kurumsal';
  if (entity === 'individual') return 'Özel Müşteri';
  return null;
}

/** Liste hücresi: yalnız karttaki Kısa Ad / kısa ünvan. Unvan kırpılmaz, üretilmez. */
export function recordedCustomerShortName(customer: OperationCustomerSource): string | null {
  if (!customer || !isOperationBusinessCustomer(customer)) return null;
  const short = customer.shortName?.trim();
  return short || null;
}

/**
 * Operasyon / Acil listesi müşteri hücresi.
 * Yalnız karttaki Kısa Ad. Tam unvan basılmaz.
 */
export function resolveOperationCustomer(customer: OperationCustomerSource): {
  name: string;
  typeLabel: string | null;
  title: string;
  searchText: string;
  defined: boolean;
  customerHref: string | null;
} {
  if (!isOperationBusinessCustomer(customer)) {
    return {
      name: OPERATION_CUSTOMER_UNDEFINED,
      typeLabel: null,
      title: OPERATION_CUSTOMER_UNDEFINED,
      searchText: OPERATION_CUSTOMER_UNDEFINED.toLocaleLowerCase('tr'),
      defined: false,
      customerHref: null,
    };
  }

  const short = recordedCustomerShortName(customer);
  const typeLabel = resolveOperationCustomerTypeLabel(customer);
  const id = String(customer?.id ?? '').trim();
  const customerHref = !short && id ? customerShortNameEditHref(id) : null;
  const name = short ?? OPERATION_CUSTOMER_SHORT_UNSET;
  const defined = Boolean(short);
  const title = [name, typeLabel].filter(Boolean).join(' / ');
  const searchText = [name, customer?.companyName, typeLabel]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('tr');

  return { name, typeLabel, title, searchText, defined, customerHref };
}

/**
 * Hasar satırı: üstte karttaki Kısa Ad; altta dosya sigortası.
 * Kısa Ad yoksa tam unvan yazılmaz; «Kısa Ad Tanımlanmamış» karta gider.
 */
export function resolveHasarOperationCustomer(
  customer: OperationCustomerSource,
  insuranceCompany: OperationInsuranceSource,
): {
  name: string;
  typeLabel: string | null;
  title: string;
  searchText: string;
  defined: boolean;
  customerHref: string | null;
} {
  const ownerShort = recordedCustomerShortName(customer);
  const insuranceName = String(insuranceCompany?.name ?? '').trim() || null;
  const hasBusinessCustomer = isOperationBusinessCustomer(customer);
  const id = String(customer?.id ?? '').trim();

  if (!hasBusinessCustomer) {
    return {
      name: OPERATION_CUSTOMER_UNDEFINED,
      typeLabel: insuranceName,
      title: insuranceName
        ? `${OPERATION_CUSTOMER_UNDEFINED} / ${insuranceName}`
        : OPERATION_CUSTOMER_UNDEFINED,
      searchText: [OPERATION_CUSTOMER_UNDEFINED, insuranceName]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('tr'),
      defined: false,
      customerHref: null,
    };
  }

  const line1 = ownerShort ?? OPERATION_CUSTOMER_SHORT_UNSET;
  const line2 =
    insuranceName && ownerShort !== insuranceName
      ? insuranceName
      : null;
  const title = [line1, line2].filter(Boolean).join(' / ');
  const searchText = [line1, customer?.companyName, line2]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('tr');

  return {
    name: line1,
    typeLabel: line2,
    title,
    searchText,
    defined: Boolean(ownerShort),
    customerHref: ownerShort || !id ? null : customerShortNameEditHref(id),
  };
}
