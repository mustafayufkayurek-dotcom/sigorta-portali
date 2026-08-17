import {
  IsString,
  IsOptional,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class WorkItemDto {
  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsNumber()
  @IsOptional()
  vatRate?: number;
}

export class CreateInvoiceRequestDto {
  @IsIn(['claim', 'emergency'])
  serviceType!: string;

  @IsString()
  @IsOptional()
  claimFileId?: string;

  @IsString()
  @IsOptional()
  emergencyCaseId?: string;

  @IsString()
  @IsNotEmpty()
  fileNo!: string;

  @IsString()
  @IsOptional()
  insuranceCompanyId?: string;

  @IsString()
  @IsOptional()
  insuranceCompanyName?: string;

  @IsNumber()
  @Min(0)
  totalAmount!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkItemDto)
  workItemsSummary!: WorkItemDto[];

  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateInvoiceRequestStatusDto {
  @IsIn(['pending', 'approved', 'invoiced', 'cancelled'])
  status!: string;

  @IsString()
  @IsOptional()
  invoiceId?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
