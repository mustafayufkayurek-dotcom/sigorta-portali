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
  salesInvoiceNo?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  cancelReason?: string;

  @IsOptional()
  @IsString()
  invoiceDate?: string;

  @IsOptional()
  @IsString()
  documentDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  subtotalAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  vatAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalAmount?: number;
}

export class BulkInvoiceRequestsDto {
  @IsArray()
  @IsString({ each: true })
  ids!: string[];

  @IsString()
  @IsNotEmpty()
  salesInvoiceNo!: string;

  @IsOptional()
  @IsString()
  invoiceDate?: string;

  @IsOptional()
  @IsString()
  documentDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  subtotalAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  vatAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalAmount?: number;
}
