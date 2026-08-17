import { IsString, IsOptional, IsNumber, IsIn, MaxLength, Min } from 'class-validator';

export class UpdateClaimLocationDto {
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
