import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class OpenExtraRepairDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  estimatedAmount?: number;
}

export class RejectExtraRepairDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason!: string;
}
