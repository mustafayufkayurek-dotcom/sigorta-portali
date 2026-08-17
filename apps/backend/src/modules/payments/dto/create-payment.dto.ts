import { IsString, IsOptional, IsNumber, IsDateString, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePaymentDto {
  @ApiProperty()
  @IsString()
  claimFileId!: string;

  @ApiProperty({ enum: ['incoming', 'outgoing'] })
  @IsIn(['incoming', 'outgoing'])
  paymentType!: string;

  @ApiProperty()
  @IsDateString()
  paymentDate!: string;

  @ApiProperty()
  @IsNumber()
  amount!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ enum: ['eft', 'havale', 'credit_card', 'cash', 'offset'] })
  @IsIn(['eft', 'havale', 'credit_card', 'cash', 'offset'])
  method!: string;

  @ApiProperty({ enum: ['insurance_company', 'vendor', 'customer'] })
  @IsIn(['insurance_company', 'vendor', 'customer'])
  payerType!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  payerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  invoiceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referenceNo?: string;

  @ApiPropertyOptional({ enum: ['pending', 'completed', 'cancelled'] })
  @IsOptional()
  @IsIn(['pending', 'completed', 'cancelled'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankAccountId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
