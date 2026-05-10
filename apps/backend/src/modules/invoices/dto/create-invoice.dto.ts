import { IsString, IsOptional, IsNumber, IsDateString, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateInvoiceDto {
  @ApiProperty()
  @IsString()
  claimFileId!: string;

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

  @ApiProperty({ enum: ['insurance_company', 'vendor', 'customer'] })
  @IsIn(['insurance_company', 'vendor', 'customer'])
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
