import { isExpertFirmCustomer } from '@sigorta/shared';
import {
  customerDisplayName,
  customerSubTypeLabel,
  resolveCustomerType,
} from '@/utils/customer-form-helpers';

export type OperationCustomerSource = {
  id?: string | null;
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

  // Alt tip yok: yalnızca şirket adı olan kurumsal kayıt kabul
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

/**
 * Operasyon listesi müşteri hücresi (Acil ve genel).
 * Yalnızca iş müşterisi (`customer` ilişkisi); sigortalı adı / dosya no gösterilmez.
 */
export function resolveOperationCustomer(customer: OperationCustomerSource): {
  name: string;
  typeLabel: string | null;
  title: string;
  searchText: string;
  defined: boolean;
} {
  if (!isOperationBusinessCustomer(customer)) {
    return {
      name: OPERATION_CUSTOMER_UNDEFINED,
      typeLabel: null,
      title: OPERATION_CUSTOMER_UNDEFINED,
      searchText: OPERATION_CUSTOMER_UNDEFINED.toLocaleLowerCase('tr'),
      defined: false,
    };
  }

  const rawName = customerDisplayName(customer!);
  const name = rawName === '—' ? OPERATION_CUSTOMER_UNDEFINED : rawName;
  const typeLabel = name === OPERATION_CUSTOMER_UNDEFINED
    ? null
    : resolveOperationCustomerTypeLabel(customer);
  const defined = name !== OPERATION_CUSTOMER_UNDEFINED;
  const title = typeLabel ? `${name} / ${typeLabel}` : name;
  const searchText = [name, typeLabel].filter(Boolean).join(' ').toLocaleLowerCase('tr');

  return { name, typeLabel, title, searchText, defined };
}

/**
 * Hasar satırı müşteri hücresi — yalnızca kurum adları, tip etiketi yok:
 * 1) Eksper ofisi (`claim.customer` / expert firm)
 * 2) Sigorta şirketi (`claim.insuranceCompany`)
 * Eksik taraf hiç gösterilmez (boş satır / placeholder yok).
 * İkisi de yoksa tek satır «Müşteri Tanımlanmamış». Tahmin yok.
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
} {
  const expertRaw = isExpertFirmCustomer(customer)
    ? customerDisplayName(customer!).trim()
    : '';
  const expertName = expertRaw && expertRaw !== '—' ? expertRaw : null;

  const insuranceRaw = String(insuranceCompany?.name ?? '').trim();
  const insuranceName = insuranceRaw || null;

  if (!expertName && !insuranceName) {
    return {
      name: OPERATION_CUSTOMER_UNDEFINED,
      typeLabel: null,
      title: OPERATION_CUSTOMER_UNDEFINED,
      searchText: OPERATION_CUSTOMER_UNDEFINED.toLocaleLowerCase('tr'),
      defined: false,
    };
  }

  // Tek taraf varsa tek satır; ikisi varsa eksper üstte, sigorta altta.
  const line1 = expertName ?? insuranceName!;
  const line2 = expertName && insuranceName ? insuranceName : null;
  const title = line2 ? `${line1} / ${line2}` : line1;
  const searchText = [line1, line2].filter(Boolean).join(' ').toLocaleLowerCase('tr');

  return {
    name: line1,
    typeLabel: line2,
    title,
    searchText,
    defined: true,
  };
}
