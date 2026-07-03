import { IsEmail, IsIn, IsOptional, IsString } from 'class-validator';

export class CreateCustomerFromInboxDto {
  @IsString()
  @IsIn(['individual', 'corporate'], { message: 'Müşteri tipi individual veya corporate olmalıdır' })
  entityType!: 'individual' | 'corporate';

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
