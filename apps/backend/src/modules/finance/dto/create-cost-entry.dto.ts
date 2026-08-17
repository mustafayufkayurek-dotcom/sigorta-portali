import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsOptional,
  IsIn,
  IsDateString,
  Min,
  Max,
} from 'class-validator';

export class CreateCostEntryDto {
  @IsString()
  @IsNotEmpty()
  expenseCategoryId!: string;

  @IsOptional()
  @IsString()
  vendorId?: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  vatRate?: number;

  @IsOptional()
  @IsString()
  invoiceNo?: string;

  @IsDateString()
  entryDate!: string;

  @IsOptional()
  @IsIn(['manual', 'vendor_statement', 'logo_erp', 'overhead_allocation'])
  source?: string;

  @IsOptional()
  @IsString()
  sourceRefId?: string;

  @IsOptional()
  isOverhead?: boolean;

  @IsOptional()
  @IsString()
  extraWorkItemId?: string;
}
