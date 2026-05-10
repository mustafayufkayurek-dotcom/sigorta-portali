import { IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class VendorRiskScoreQueryDto {
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsString()
  riskLevel?: string;

  @IsOptional()
  @IsString()
  search?: string;
}

export class AnomalyQueryDto {
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsString()
  vendorId?: string;

  @IsOptional()
  @IsString()
  flagType?: string;

  @IsOptional()
  @IsString()
  severity?: string;

  @IsOptional()
  @IsString()
  reportId?: string;
}

export class ReviewAnomalyDto {
  @IsString()
  status!: 'reviewed' | 'dismissed' | 'escalated';

  @IsOptional()
  @IsString()
  reviewNote?: string;
}
