import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  IsDateString,
  MaxLength,
  Min,
  Max,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRegionDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsString()
  @MaxLength(50)
  code!: string;
}

export class SetAdjustmentDto {
  @Type(() => Number)
  @IsNumber()
  @Min(-100)
  @Max(500)
  adjustmentPercent!: number;

  @IsDateString()
  effectiveDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class BulkAdjustmentDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  regionIds!: string[];

  @Type(() => Number)
  @IsNumber()
  @Min(-100)
  @Max(500)
  adjustmentPercent!: number;

  @IsDateString()
  effectiveDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
