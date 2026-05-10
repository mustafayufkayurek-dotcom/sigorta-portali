import { IsString, IsOptional, IsNumber, IsDateString, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateInvoiceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  invoiceDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  counterpartyType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  counterpartyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  subtotalAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  vatAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  withholdingAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  totalAmount?: number;

  @ApiPropertyOptional({ enum: ['draft', 'sent', 'paid', 'partial', 'cancelled', 'overdue'] })
  @IsOptional()
  @IsIn(['draft', 'sent', 'paid', 'partial', 'cancelled', 'overdue'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  documentFileId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
