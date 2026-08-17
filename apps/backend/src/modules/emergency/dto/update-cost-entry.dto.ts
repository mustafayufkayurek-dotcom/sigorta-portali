import { IsString, IsNumber, IsOptional, IsDateString } from 'class-validator';

export class UpdateCostEntryDto {
  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  amount?: number;

  @IsDateString()
  @IsOptional()
  entryDate?: string;

  @IsString()
  @IsOptional()
  receiptKey?: string;

  @IsString()
  @IsOptional()
  vendorId?: string | null;
}
