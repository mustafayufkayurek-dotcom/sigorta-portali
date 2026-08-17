import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

export const DAMAGE_TYPES = ['FIRE_HOME', 'FIRE_INDUSTRIAL', 'WATER_INTERNAL', 'VEHICLE_IMPACT', 'NATURAL_DISASTER', 'EARTHQUAKE'] as const;
export const DAMAGE_SIZES = ['SMALL', 'MEDIUM', 'LARGE'] as const;

export class CreateDamageRepairTemplateDto {
  @IsIn(DAMAGE_TYPES)
  damageType!: string;

  @IsString()
  workSubGroupId!: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  defaultQuantitySmall?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  defaultQuantityMedium?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  defaultQuantityLarge?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  sortOrder?: number;
}

export class UpdateDamageRepairTemplateDto {
  @IsOptional()
  @IsIn(DAMAGE_TYPES)
  damageType?: string;

  @IsOptional()
  @IsString()
  workSubGroupId?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  defaultQuantitySmall?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  defaultQuantityMedium?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  defaultQuantityLarge?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isGlobal?: boolean;
}

export class SuggestionsDto {
  @IsArray()
  @IsIn(DAMAGE_TYPES, { each: true })
  damageTypes!: string[];

  @IsOptional()
  @IsIn(DAMAGE_SIZES)
  damageSize?: string;

  @IsOptional()
  @IsString()
  fileId?: string;
}