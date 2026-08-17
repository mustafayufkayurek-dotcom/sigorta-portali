import { IsString, IsOptional, IsNumber, MaxLength, MinLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateWorkSubGroupDto {
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

  @IsString()
  unitType!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sortOrder?: number;
}
