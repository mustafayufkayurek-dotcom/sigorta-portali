import { IsString, IsArray, IsBoolean, IsInt, IsEnum, IsObject, IsOptional } from 'class-validator';

export class CreateClaimResponsibilityDto {
  @IsString()
  userId!: string;

  @IsString()
  departmentId!: string;

  @IsEnum(['city', 'district', 'region', 'countrywide'])
  regionType!: string;

  @IsArray()
  @IsString({ each: true })
  regionValues!: string[];

  @IsOptional()
  @IsEnum(['all', 'specific_subjects'])
  coverageType?: string;

  @IsOptional()
  @IsObject()
  coverageConfig?: Record<string, any>;

  @IsOptional()
  @IsInt()
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateClaimResponsibilityDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsEnum(['city', 'district', 'region', 'countrywide'])
  regionType?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  regionValues?: string[];

  @IsOptional()
  @IsEnum(['all', 'specific_subjects'])
  coverageType?: string;

  @IsOptional()
  @IsObject()
  coverageConfig?: Record<string, any>;

  @IsOptional()
  @IsInt()
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
