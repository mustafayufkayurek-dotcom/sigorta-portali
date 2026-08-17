import type { ParsedInboxEmailContent } from '@/utils/inbound-email-content-parser';
import { toTitleCaseTR } from '@/utils/text-helpers';

export const INBOX_CUSTOMER_PREFILL_STORAGE_KEY = 'meridyen.inboxCustomerPrefill.v1';

export interface InboxContactPrefill {
  firstName: string;
  lastName: string;
  role: string;
  phone: string;
  phoneType: 'gsm' | 'landline';
  extensionNo: string;
  email: string;
}

export interface InboxCustomerPrefillPayload {
  source: 'operation-inbox';
  messageId?: string;
  initialSection?: number;
  openContacts?: boolean;
  focusContactRole?: boolean;
  toastMessage?: string;
  form: {
    customerType?: 'individual' | 'corporate';
    subType?: '' | 'insured' | 'private_customer' | 'eksper' | 'sigorta_sirketi' | 'eksper_firmasi' | 'asistan_firmasi';
    firstName?: string;
    lastName?: string;
    companyName?: string;
    taxNumber?: string;
    contactFirstName?: string;
    contactLastName?: string;
    phone?: string;
    email?: string;
    phoneType?: 'gsm' | 'landline';
    serviceType?: 'hasar' | 'acil_yardim' | '';
    source?: string;
    notes?: string;
  };
  contacts?: InboxContactPrefill[];
}

const REMED_CORPORATE = {
  companyName: 'Remed Uluslararası Destek Ve Danışmanlık Hizmetleri Tic. A.Ş.',
  taxNumber: '7340735275',
};

/** "Tuğçe İşlek" → { firstName, lastName } */
export function parseSenderPersonName(fullName: string): { firstName: string; lastName: string } {
  const normalized = toTitleCaseTR(fullName.trim());
  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function buildSenderContact(fromName: string | null, fromAddress: string): InboxContactPrefill | null {
  if (!fromName?.trim() && !fromAddress.trim()) return null;
  const person = parseSenderPersonName(fromName ?? fromAddress.split('@')[0] ?? '');
  return {
    firstName: person.firstName,
    lastName: person.lastName,
    role: '',
    phone: '',
    phoneType: 'gsm',
    extensionNo: '',
    email: fromAddress.trim().toLowerCase(),
  };
}

/**
 * Gelen kutusu e-postasından müşteri kartı ön-dolumu.
 * Remed: kurumsal asistan firması + gönderen personel iletişim kişisi.
 */
export function buildInboxCustomerPrefill(input: {
  fromName: string | null;
  fromAddress: string;
  parsed: ParsedInboxEmailContent;
  messageId?: string;
}): InboxCustomerPrefillPayload | null {
  const { fromName, fromAddress, parsed, messageId } = input;
  const senderContact = buildSenderContact(fromName, fromAddress);
  const inboxNote = parsed.formTitle
    ? `Gelen kutusu — ${parsed.formTitle}`
    : parsed.claimNo
      ? `Gelen kutusu — ${parsed.claimNo}`
      : undefined;

  if (parsed.senderProfile === 'remed') {
    const person = parseSenderPersonName(fromName ?? '');
    const contact = senderContact ?? {
      firstName: person.firstName,
      lastName: person.lastName,
      role: '',
      phone: '',
      phoneType: 'gsm' as const,
      extensionNo: '',
      email: fromAddress.trim().toLowerCase(),
    };

    return {
      source: 'operation-inbox',
      messageId,
      initialSection: 1,
      openContacts: true,
      focusContactRole: true,
      toastMessage: contact.firstName
        ? `Gelen kutusundan ${contact.firstName} ${contact.lastName}`.trim() + ' iletişim bilgileri aktarıldı. Görevini seçmeniz yeterli.'
        : 'Remed müşteri kartı gelen kutusundan hazırlandı.',
      form: {
        customerType: 'corporate',
        subType: 'asistan_firmasi',
        companyName: REMED_CORPORATE.companyName,
        taxNumber: REMED_CORPORATE.taxNumber,
        serviceType: 'acil_yardim',
        contactFirstName: contact.firstName,
        contactLastName: contact.lastName,
        email: contact.email,
        notes: inboxNote,
      },
      contacts: [contact],
    };
  }

  // Sigorta ettiren bireysel + gönderen kişi iletişimde (varsa)
  if (parsed.customerName) {
    const insured = parseSenderPersonName(parsed.customerName);
    const digits = parsed.phone?.replace(/\D/g, '') ?? '';
    const phone = digits.length >= 10 ? digits : '';

    return {
      source: 'operation-inbox',
      messageId,
      initialSection: senderContact ? 1 : 0,
      openContacts: !!senderContact,
      focusContactRole: !!senderContact,
      toastMessage: senderContact?.firstName
        ? `${senderContact.firstName} ${senderContact.lastName}`.trim() + ' gönderen olarak eklendi. Görevini seçmeniz yeterli.'
        : undefined,
      form: {
        customerType: 'individual',
        subType: 'insured',
        firstName: insured.firstName,
        lastName: insured.lastName,
        phone,
        notes: inboxNote,
      },
      contacts: senderContact ? [senderContact] : undefined,
    };
  }

  // Yalnızca gönderen bilgisi
  if (senderContact?.firstName) {
    return {
      source: 'operation-inbox',
      messageId,
      initialSection: 1,
      openContacts: true,
      focusContactRole: true,
      toastMessage: `${senderContact.firstName} ${senderContact.lastName}`.trim() + ' iletişim bilgileri aktarıldı. Görevini seçmeniz yeterli.',
      form: {
        contactFirstName: senderContact.firstName,
        contactLastName: senderContact.lastName,
        email: senderContact.email,
        notes: inboxNote,
      },
      contacts: [senderContact],
    };
  }

  return null;
}

export function stashInboxCustomerPrefill(payload: InboxCustomerPrefillPayload): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(INBOX_CUSTOMER_PREFILL_STORAGE_KEY, JSON.stringify(payload));
}

export function consumeInboxCustomerPrefill(): InboxCustomerPrefillPayload | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(INBOX_CUSTOMER_PREFILL_STORAGE_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(INBOX_CUSTOMER_PREFILL_STORAGE_KEY);
  try {
    return JSON.parse(raw) as InboxCustomerPrefillPayload;
  } catch {
    return null;
  }
}

export function openCustomerPrefillFromInbox(payload: InboxCustomerPrefillPayload): void {
  stashInboxCustomerPrefill(payload);
  window.open('/panel/musteriler?inboxPrefill=1', '_blank', 'noopener,noreferrer');
}
