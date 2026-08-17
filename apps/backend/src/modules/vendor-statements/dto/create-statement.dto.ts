import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  IsArray,
  ValidateNested,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateStatementItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paymentId?: string;

  @ApiProperty()
  @IsString()
  claimFileId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  repairReportItemId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  workGroupId?: string;

  @ApiProperty()
  @IsString()
  lineDescription!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  totalAmount!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  vatRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  receiptRef?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  receiptDate?: string;
}

export class CreateStatementDto {
  @ApiProperty()
  @IsString()
  vendorId!: string;

  @ApiProperty()
  @IsDateString()
  periodStart!: string;

  @ApiProperty()
  @IsDateString()
  periodEnd!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ type: [CreateStatementItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateStatementItemDto)
  items?: CreateStatementItemDto[];
}

export class UpdateStatementDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  periodEnd?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateDisputeDto {
  @ApiProperty()
  @IsString()
  statementItemId!: string;

  @ApiProperty({
    enum: ['AMOUNT_MISMATCH', 'ITEM_NOT_DONE', 'WRONG_CLAIM', 'NOT_RECEIVED', 'OTHER'],
  })
  @IsString()
  reason!: string;

  @ApiProperty()
  @IsString()
  @MinLength(20, { message: 'İtiraz açıklaması en az 20 karakter olmalıdır' })
  reasonNote!: string;
}

export class ResolveDisputeDto {
  @ApiProperty({ enum: ['RESOLVED_ACCEPT', 'RESOLVED_REJECT'] })
  @IsString()
  resolution!: string;

  @ApiProperty()
  @IsString()
  @MinLength(5)
  resolvedNote!: string;
}
