import { IsArray, IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class BindClaimLocationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  categoryId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categoryIds?: string[];

  @IsOptional()
  @IsBoolean()
  allCategories?: boolean;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  mahalName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  bolgeName?: string;
}
