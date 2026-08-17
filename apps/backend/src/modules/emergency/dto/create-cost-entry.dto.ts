import { IsString, IsNumber, IsOptional, IsNotEmpty, IsDateString } from 'class-validator';

export class CreateCostEntryDto {
  @IsString()
  @IsNotEmpty()
  entryType!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsNumber()
  amount!: number;

  @IsDateString()
  entryDate!: string;

  @IsString()
  @IsOptional()
  receiptKey?: string;

  @IsString()
  @IsOptional()
  vendorId?: string;
}
