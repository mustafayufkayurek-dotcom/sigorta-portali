import { IsArray, IsBoolean, IsIn, IsNumber, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { FieldSurveyItemType } from '../field-survey-item-types';
import { FIELD_SURVEY_ITEM_TYPES } from '../field-survey-item-types';

const ITEM_TYPES: FieldSurveyItemType[] = FIELD_SURVEY_ITEM_TYPES;

class DimensionModuleDto {
  @IsString()
  @MaxLength(60)
  label!: string;

  @IsOptional()
  @IsNumber()
  genislikCm?: number | null;

  @IsOptional()
  @IsNumber()
  yukseklikCm?: number | null;

  @IsOptional()
  @IsNumber()
  derinlikCm?: number | null;
}

class MaterialDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  quantity?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  note?: string | null;
}

export class CreateFieldSurveyBriefDto {
  @IsIn(ITEM_TYPES)
  itemType!: FieldSurveyItemType;

  @IsString()
  @MaxLength(80)
  title!: string;

  @IsString()
  @MaxLength(400)
  summaryText!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DimensionModuleDto)
  dimensions!: DimensionModuleDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MaterialDto)
  materials!: MaterialDto[];

  @IsOptional()
  @IsNumber()
  aiConfidence?: number | null;

  @IsOptional()
  @IsBoolean()
  isEstimated?: boolean;

  @IsOptional()
  @IsString()
  photoUrl?: string | null;

  @IsOptional()
  @IsString()
  annotatedPhotoUrl?: string | null;

  @IsOptional()
  @IsIn(['draft', 'sent'])
  status?: 'draft' | 'sent';
}

export class ShareFieldSurveyBriefDto {
  @IsOptional()
  @IsString()
  phone?: string;
}
