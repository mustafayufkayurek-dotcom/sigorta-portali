import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateHrAssetDto {
  @IsString()
  employeeProfileId!: string;

  @IsString()
  @MaxLength(40)
  category!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  brand!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  model!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  serialNumber!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
