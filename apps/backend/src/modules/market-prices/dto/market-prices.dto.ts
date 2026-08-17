import { IsString, IsNumber, IsOptional, IsBoolean, IsDateString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateMarketPriceDto {
  @IsString()
  workGroupId!: string;

  @IsString()
  jobDescription!: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  regionType?: string; // national | istanbul | anatolian

  @IsNumber()
  @Min(0)
  minPrice!: number;

  @IsNumber()
  @Min(0)
  maxPrice!: number;

  @IsNumber()
  @Min(0)
  referencePrice!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  tolerancePct?: number;

  @IsOptional()
  @IsString()
  source?: string;

  @IsDateString()
  validFrom!: string;

  @IsOptional()
  @IsDateString()
  validTo?: string;
}

export class UpdateMarketPriceDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  referencePrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  tolerancePct?: number;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @IsOptional()
  @IsDateString()
  validTo?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  regionType?: string;
}

export class MarketPriceLookupDto {
  @IsString()
  workGroupId!: string;

  @IsOptional()
  @IsString()
  jobDescription?: string;

  @IsOptional()
  @IsString()
  regionType?: string;
}

export class MarketPriceQueryDto {
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsString()
  workGroupId?: string;

  @IsOptional()
  @IsString()
  regionType?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;
}
