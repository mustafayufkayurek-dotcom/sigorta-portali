import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsEmail, IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateNested } from 'class-validator';

export class CreateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiProperty()
  @IsUUID()
  roleId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  adjusterId?: string;

  @ApiProperty()
  @IsString()
  firstName!: string;

  @ApiProperty()
  @IsString()
  lastName!: string;

  /** Firma içinde yazılan görev — koddan gelmez */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  jobTitle?: string;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  employeeCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isMobileUser?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isWebUser?: boolean;

  @ApiPropertyOptional({ description: 'Mesai saati kısıtı. Yalnız Meridyen personeli.' })
  @IsOptional()
  @IsBoolean()
  workHoursRestricted?: boolean;

  /** Eksper daveti — müşteri kaydı (eksper_firmasi) */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  expertCustomerId?: string;

  /** Sigorta portal daveti — Ayarlar sigorta şirketi (eski kart id’si durur, okunmaz) */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  insuranceCustomerId?: string;

  /** Portal ofis bağları — müşteri kartı */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  portalCustomerId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  insuranceCompanyIds?: string[];

  /** Broker daveti — müşteri kaydı (broker_firmasi); mail kurum adı için */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  brokerCustomerId?: string;

  /** Asistans firma portal daveti — müşteri kaydı (asistan_firmasi) */
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  assistantCustomerIds?: string[];
}

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password?: string;
}

export class ScreenPermissionInputDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  screenCode?: string;

  @ApiProperty()
  @IsBoolean()
  canView!: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  canEdit?: boolean;
}

export class UpdateScreenPermissionsDto {
  @ApiPropertyOptional({ type: [ScreenPermissionInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScreenPermissionInputDto)
  screens?: ScreenPermissionInputDto[];

  @ApiPropertyOptional({ type: [ScreenPermissionInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScreenPermissionInputDto)
  screenPermissions?: ScreenPermissionInputDto[];

  @Transform(({ obj }) => obj.screens ?? obj.screenPermissions ?? [])
  normalizedScreens!: ScreenPermissionInputDto[];
}

export type NormalizedScreenPermission = {
  code: string;
  canView: boolean;
  canEdit?: boolean;
};

export class UpdateInsuranceCompanyScopesDto {
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  insuranceCompanyIds?: string[];
}

export class BulkDeleteUsersDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  ids!: string[];
}