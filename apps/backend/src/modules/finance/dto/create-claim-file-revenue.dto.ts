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
  ValidateIf,
} from 'class-validator';

export class CreateClaimFileRevenueDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['file_fee', 'extra_work'])
  revenueType!: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['insurance_company', 'insured'])
  collectionSource!: string;

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
  invoiceId?: string;

  @IsOptional()
  @IsString()
  repairReportId?: string;

  /**
   * revenueType='extra_work' ise zorunlu; 'file_fee' ise null olmalı
   */
  @ValidateIf((o) => o.revenueType === 'extra_work')
  @IsString()
  @IsNotEmpty()
  extraWorkItemId?: string;

  @IsOptional()
  @IsIn(['draft', 'confirmed', 'collected', 'cancelled'])
  status?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  collectedAmount?: number;

  @IsOptional()
  @IsDateString()
  collectedAt?: string;

  @IsOptional()
  @IsString()
  relatedPaymentId?: string;

  @IsDateString()
  entryDate!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
