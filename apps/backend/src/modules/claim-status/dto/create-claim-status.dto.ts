import { IsBoolean, IsHexColor, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateClaimStatusDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsInt()
  sequenceNo!: number;

  @IsOptional()
  @IsHexColor()
  color?: string;

  @IsOptional()
  @IsBoolean()
  isClosedState?: boolean;

  @IsOptional()
  @IsInt()
  maxDurationHours?: number;

  @IsOptional()
  @IsInt()
  slaWarningPercent?: number;

  @IsOptional()
  @IsInt()
  slaCriticalPercent?: number;

  @IsOptional()
  @IsInt()
  slaEscalationPercent?: number;

  @IsOptional()
  @IsBoolean()
  isWaitingState?: boolean;
}