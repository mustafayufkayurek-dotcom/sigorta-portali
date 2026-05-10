import { IsOptional, IsString, IsDateString, IsInt, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class BranchDistributionFiltersDto {
  @ApiPropertyOptional({ description: 'Başlangıç tarihi (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Bitiş tarihi (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ description: 'Müşteri ID filtresi' })
  @IsOptional()
  @IsString()
  customerId?: string;
}

export class BranchTrendFiltersDto {
  @ApiPropertyOptional({ description: 'Son kaç ay (varsayılan: 12)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  months?: number;

  @ApiPropertyOptional({ description: 'Müşteri ID filtresi' })
  @IsOptional()
  @IsString()
  customerId?: string;
}

export class CustomerPerformanceFiltersDto {
  @ApiPropertyOptional({ description: 'Başlangıç tarihi (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Bitiş tarihi (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ description: 'Hizmet türü filtresi (HASAR | ACIL_YARDIM)' })
  @IsOptional()
  @IsString()
  serviceType?: string;

  @ApiPropertyOptional({ description: 'Branş filtresi (productBranch)' })
  @IsOptional()
  @IsString()
  branch?: string;
}

export class BranchAlertsFiltersDto {
  @ApiPropertyOptional({ description: 'Son kaç ay kontrol edilsin (varsayılan: 3)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  months?: number;
}

export class StaffPerformanceFiltersDto {
  @ApiPropertyOptional({ description: 'Son kaç gün (varsayılan: 30)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number;
}

export class ClosureSpeedFiltersDto {
  @ApiPropertyOptional({ description: 'Son kaç ay (varsayılan: 6)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  months?: number;

  @ApiPropertyOptional({ description: 'Hedef kapama süresi (gün, varsayılan: 15)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  targetDays?: number;
}

export class ProfitabilityFiltersDto {
  @ApiPropertyOptional({ description: 'Son kaç ay (varsayılan: 6)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  months?: number;
}
