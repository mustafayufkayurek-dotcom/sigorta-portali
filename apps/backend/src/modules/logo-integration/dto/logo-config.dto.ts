import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdateLogoConfigDto {
  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;

  @IsString()
  @IsNotEmpty()
  apiBaseUrl!: string;

  @IsString()
  @IsNotEmpty()
  clientId!: string;

  @IsString()
  @IsNotEmpty()
  clientSecret!: string;

  @IsString()
  @IsNotEmpty()
  username!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;

  @IsInt()
  @Min(1)
  firmNo!: number;

  @IsString()
  @IsOptional()
  companyCodePrefix?: string;
}

export class ManualSyncTriggerDto {
  @IsString()
  @IsNotEmpty()
  entityType!: string;

  @IsString()
  @IsOptional()
  entityId?: string;
}
