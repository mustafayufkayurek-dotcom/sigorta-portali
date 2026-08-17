import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

const INBOX_CUSTOMER_SUB_TYPES = [
  'insured',
  'private_customer',
  'sigorta_sirketi',
  'eksper_firmasi',
  'asistan_firmasi',
  'broker_firmasi',
  'eksper',
] as const;

export class CreateCustomerFromInboxDto {
  @IsString()
  @IsIn(['individual', 'corporate'], { message: 'Müşteri tipi individual veya corporate olmalıdır' })
  entityType!: 'individual' | 'corporate';

  /** Bireysel/kurumsal alt tip — alan zorunluluğu ayarı açıkken zorunlu */
  @IsString()
  @IsNotEmpty({ message: 'Müşteri tipi (alt tip) seçimi zorunludur.' })
  @IsIn(INBOX_CUSTOMER_SUB_TYPES, { message: 'Geçerli bir müşteri alt tipi seçiniz' })
  subType!: (typeof INBOX_CUSTOMER_SUB_TYPES)[number];

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  /** Sigortalı adresi — müşteri kartına not olarak eklenir */
  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Geçerli bir e-posta adresi girin' })
  email?: string;
}
