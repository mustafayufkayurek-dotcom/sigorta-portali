import { IsOptional, IsString, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class DashboardFiltersDto {
  @ApiPropertyOptional({ description: 'Başlangıç tarihi (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Bitiş tarihi (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ description: 'Sigorta şirketi ID' })
  @IsOptional()
  @IsString()
  insuranceCompanyId?: string;

  @ApiPropertyOptional({ description: 'Branş (productBranch)' })
  @IsOptional()
  @IsString()
  productBranch?: string;

  @ApiPropertyOptional({ description: 'Kullanıcı ID (sorumlu filtresi)' })
  @IsOptional()
  @IsString()
  userId?: string;
}
