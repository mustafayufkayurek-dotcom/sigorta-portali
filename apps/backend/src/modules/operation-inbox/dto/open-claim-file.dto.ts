import { Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { CreateCustomerFromInboxDto } from './create-customer-from-inbox.dto';

export class OpenClaimFileDto {
  @IsString()
  @IsNotEmpty({ message: 'Talimat metni zorunludur' })
  @MinLength(3, { message: 'Talimat en az 3 karakter olmalıdır' })
  instruction!: string;

  @IsString()
  @IsOptional()
  insuranceCompanyId?: string;

  @IsString()
  @IsOptional()
  assignedUserId?: string;

  @IsString()
  @IsOptional()
  customerId?: string;

  /** Dosyaya yazılacak sigortalı adı soyadı (mail formundan veya manuel) */
  @IsString()
  @IsOptional()
  insuredName?: string;

  @IsString()
  @IsOptional()
  insuredPhone?: string;

  @IsString()
  @IsOptional()
  insuredAddress?: string;

  @IsString()
  @IsOptional()
  fileNo?: string;

  @IsString()
  @IsOptional()
  policyNo?: string;

  @IsString()
  @IsOptional()
  claimNo?: string;

  @IsString()
  @IsOptional()
  lossType?: string;

  @IsString()
  @IsOptional()
  fileSubject?: string;

  /** Mail formu / hasar açıklaması — İhbar İçeriği alanına yazılır */
  @IsString()
  @IsOptional()
  description?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateCustomerFromInboxDto)
  createCustomer?: CreateCustomerFromInboxDto;
}
