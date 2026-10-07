import { IsString, IsOptional, IsNumber, IsIn, MaxLength, Min } from 'class-validator';

export class UpdateClaimDamageCategoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: string;
}
