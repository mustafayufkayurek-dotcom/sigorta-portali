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
  { value: 'asistan_firmasi', label: 'Asistan Firması', forType: 'corporate', color: 'orange' },
  { value: 'eksper', label: 'Eksper', forType: 'individual', color: 'purple' },
  { value: 'eksper_firmasi', label: 'Eksper Firması', forType: 'corporate', color: 'purple' },
  { value: 'insured', label: 'Sigortalı', forType: 'both', color: 'orange' },
  { value: 'private_customer', label: 'Özel Müşteri', forType: 'individual', color: 'green' },
];

const SUB_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  DEFAULT_CUSTOMER_SUB_TYPES.map((t) => [t.value, t.label]),
);

/** Alt tip seçildiğinde form altında gösterilen kısa yönlendirme metni */
const SUB_TYPE_HINTS: Record<string, string> = {
  sigorta_sirketi: 'Sigorta şirketi bilgilerini giriniz. Branş seçimini aşağıdan tamamlayın.',
  asistan_firmasi: 'Asistan firması bilgilerini giriniz.',
  eksper_firmasi: 'Eksper firması bilgilerini giriniz.',
  eksper: 'Eksper bilgilerini giriniz.',
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

export function subTypeActiveClass(color: CustomerSubTypeDef['color']): string {
  switch (color) {
    case 'orange': return 'bg-orange-500 text-white border-orange-500';
    case 'green': return 'bg-green-600 text-white border-green-600';
    case 'purple': return 'bg-purple-600 text-white border-purple-600';
    case 'blue': return 'bg-blue-600 text-white border-blue-600';
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
  'Kayıt anında temel ilişki alanlarıdır. Görüşme notları, takip kayıtları ve durum geçmişi için sol menüdeki CRM modülünü kullanın.';
