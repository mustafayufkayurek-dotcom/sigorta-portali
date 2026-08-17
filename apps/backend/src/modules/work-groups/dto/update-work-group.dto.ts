import { IsString, IsOptional, IsNumber, IsIn, MaxLength, Min } from 'class-validator';

export class UpdateWorkGroupDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: string;
}
