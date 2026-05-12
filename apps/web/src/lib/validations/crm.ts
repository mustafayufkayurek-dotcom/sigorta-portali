import { z } from 'zod';

// ─── Temel Validasyonlar ──────────────────────────────────────────────────────

/** TC Kimlik No — 11 haneli, algoritma doğrulamalı */
export const tcKimlikSchema = z
  .string()
  .length(11, 'TC Kimlik No 11 haneli olmalıdır')
  .regex(/^\d+$/, 'Sadece rakam girilmelidir')
  .refine((val) => {
    const digits = val.split('').map(Number);
    if (digits[0] === 0) return false;
    const oddSum = digits[0] + digits[2] + digits[4] + digits[6] + digits[8];
    const evenSum = digits[1] + digits[3] + digits[5] + digits[7];
    const d10 = (oddSum * 7 - evenSum) % 10;
    if (d10 !== digits[9]) return false;
    const total = digits.slice(0, 10).reduce((a, b) => a + b, 0);
    return total % 10 === digits[10];
  }, 'Geçersiz TC Kimlik No');

/** Vergi No — 10 veya 11 haneli */
export const vergiNoSchema = z
  .string()
  .min(10, 'Vergi No en az 10 haneli olmalıdır')
  .max(11, 'Vergi No en fazla 11 haneli olmalıdır')
  .regex(/^\d+$/, 'Sadece rakam girilmelidir');

/** Telefon — 05XX XXX XX XX formatı (11 hane) */
export const phoneSchema = z
  .string()
  .min(1, 'Telefon numarası zorunludur')
  .regex(/^0[5][0-9]{9}$/, 'Geçerli bir cep telefonu numarası giriniz (05XX XXX XX XX)');

/** E-posta */
export const emailSchema = z
  .string()
  .email('Geçerli bir e-posta adresi giriniz');

/** Opsiyonel e-posta */
export const optionalEmailSchema = z
  .string()
  .email('Geçerli bir e-posta adresi giriniz')
  .or(z.literal(''))
  .optional();

/** Zorunlu metin alanı */
export const requiredString = (label: string) =>
  z.string().min(1, `${label} zorunludur`);

/** IBAN (TR ile başlayan 26 karakter) */
export const ibanSchema = z
  .string()
  .regex(/^TR\d{24}$/, 'Geçerli IBAN formatı: TR + 24 rakam')
  .or(z.literal(''))
  .optional();

// ─── Entity Schema'ları ───────────────────────────────────────────────────────

/** Müşteri (Sigortalı) oluşturma */
export const customerCreateSchema = z.object({
  customerType: z.enum(['bireysel', 'kurumsal'], { required_error: 'Müşteri tipi seçiniz' }),
  firstName: requiredString('Ad'),
  lastName: requiredString('Soyad'),
  identityNo: tcKimlikSchema.optional().or(z.literal('')),
  taxNo: vergiNoSchema.optional().or(z.literal('')),
  phone: phoneSchema,
  phone2: phoneSchema.optional().or(z.literal('')),
  email: optionalEmailSchema,
  cityCode: requiredString('İl'),
  districtCode: requiredString('İlçe'),
  address: z.string().optional(),
  notes: z.string().optional(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
});
export type CustomerCreateInput = z.infer<typeof customerCreateSchema>;

/** Tedarikçi oluşturma */
export const vendorCreateSchema = z.object({
  name: requiredString('Firma/Usta adı'),
  contactPerson: requiredString('Yetkili kişi'),
  phone: phoneSchema,
  phone2: phoneSchema.optional().or(z.literal('')),
  email: optionalEmailSchema,
  taxNo: vergiNoSchema.optional().or(z.literal('')),
  taxOffice: z.string().optional(),
  iban: ibanSchema,
  cityCode: requiredString('İl'),
  districtCode: z.string().optional(),
  address: z.string().optional(),
  serviceTypes: z.array(z.string()).min(1, 'En az bir hizmet türü seçiniz'),
  notes: z.string().optional(),
});
export type VendorCreateInput = z.infer<typeof vendorCreateSchema>;

/** Eksper oluşturma */
export const expertCreateSchema = z.object({
  firstName: requiredString('Ad'),
  lastName: requiredString('Soyad'),
  phone: phoneSchema,
  email: emailSchema,
  companyName: z.string().optional(),
  licenseNo: z.string().optional(),
  specializations: z.array(z.string()).optional(),
  regions: z.array(z.string()).optional(),
  notes: z.string().optional(),
});
export type ExpertCreateInput = z.infer<typeof expertCreateSchema>;
