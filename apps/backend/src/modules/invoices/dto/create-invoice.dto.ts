import { IsString, IsOptional, IsNumber, IsDateString, IsIn, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateInvoiceDto {
  @ApiPropertyOptional()
  @ValidateIf((o: CreateInvoiceDto) => !o.emergencyCaseId)
  @IsString()
  claimFileId?: string;

  @ApiPropertyOptional()
  @ValidateIf((o: CreateInvoiceDto) => !o.claimFileId)
  @IsOptional()
  @IsString()
  emergencyCaseId?: string;

  @ApiProperty({ enum: ['sales', 'purchase'] })
  @IsIn(['sales', 'purchase'])
  invoiceType!: string;

  @ApiProperty()
  @IsDateString()
  invoiceDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiProperty({ enum: ['insurance_company', 'vendor', 'customer', 'insured'] })
  @IsIn(['insurance_company', 'vendor', 'customer', 'insured'])
  counterpartyType!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  counterpartyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty()
  @IsNumber()
  subtotalAmount!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  vatAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  withholdingAmount?: number;

  @ApiProperty()
  @IsNumber()
  totalAmount!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  documentFileId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
