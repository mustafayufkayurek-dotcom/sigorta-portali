import { IsString, IsOptional, IsNumber, IsDateString, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePaymentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  amount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  method?: string;

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
