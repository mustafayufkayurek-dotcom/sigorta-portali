import { IsString, IsOptional, IsNumber, IsInt, Min } from 'class-validator';

export class CreateTemplateItemDto {
  @IsOptional()
  @IsString()
  workGroupId?: string;

  @IsOptional()
  @IsString()
  damageCategory?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsString()
  jobDescription!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  defaultQuantity?: number;

  @IsOptional()
  @IsString()
  defaultUnit?: string;

  @IsOptional()
  @IsString()
  pricingType?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
