import { IsString, IsOptional, IsInt, IsBoolean, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSlaRuleDto {
  @ApiProperty()
  @IsString()
  name: string = '';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  claimType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  productBranch?: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  targetDays: number = 30;

  @ApiProperty()
  @IsInt()
  @Min(1)
  warningDays: number = 7;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateSlaRuleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  claimType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  productBranch?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  targetDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  warningDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
