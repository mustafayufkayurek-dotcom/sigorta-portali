import { IsString, IsOptional, IsNumber, IsUUID, MinLength, MaxLength, Min } from 'class-validator';

export class CreateClaimLocationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsUUID()
  parentId?: string;
}
