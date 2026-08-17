import { IsString, IsOptional, IsNumber, MinLength, MaxLength, Min } from 'class-validator';

export class CreateWorkGroupDto {
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
  @IsString()
  @MaxLength(20)
  unit?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sortOrder?: number;
}
