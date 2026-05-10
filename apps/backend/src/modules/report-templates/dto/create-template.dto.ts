import { IsString, IsOptional, IsBoolean, IsInt, Min } from 'class-validator';

export class CreateTemplateDto {
  @IsString()
  name!: string;

  @IsString()
  serviceType!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
