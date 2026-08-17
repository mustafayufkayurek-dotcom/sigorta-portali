import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsEmail, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';

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

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty()
  @IsString()
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

  /** Eksper daveti — müşteri kaydı (eksper_firmasi) */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  expertCustomerId?: string;

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