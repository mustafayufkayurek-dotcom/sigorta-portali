import { IsString, IsOptional, IsDateString, MaxLength } from 'class-validator';

export class CreatePriceListVersionDto {
  @IsString()
  @MaxLength(100)
  versionName!: string;

  @IsDateString()
  effectiveDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
