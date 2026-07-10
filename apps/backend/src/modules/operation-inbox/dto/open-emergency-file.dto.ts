import { Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { CreateCustomerFromInboxDto } from './create-customer-from-inbox.dto';

export class OpenEmergencyFileDto {
  @IsString()
  @IsNotEmpty({ message: 'Talimat metni zorunludur' })
  @MinLength(3, { message: 'Talimat en az 3 karakter olmalıdır' })
  instruction!: string;

  @IsString()
  @IsOptional()
  assignedUserId?: string;

  @IsString()
  @IsOptional()
  assignedVendorId?: string;

  /** Acil yardım dosyasının bağlı olduğu asistan firması (EmergencyCase.customerId) */
  @IsString()
  @IsNotEmpty({ message: 'Asistan firması seçilmelidir' })
  assistantCustomerId!: string;

  @IsString()
  @IsOptional()
  customerId?: string;

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

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateCustomerFromInboxDto)
  createCustomer?: CreateCustomerFromInboxDto;
}
