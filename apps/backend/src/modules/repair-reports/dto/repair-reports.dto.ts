import { IsString, IsOptional, IsIn, IsNumber, IsObject, IsBoolean, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRepairReportDto {
  @IsIn(['single', 'multi', 'emergency'])
  reportType!: 'single' | 'multi' | 'emergency';

  @IsString()
  reportDate!: string;

  @IsOptional()
  @IsString()
  inspectorName?: string;

  @IsOptional()
  @IsString()
  reporterName?: string;

  @IsOptional()
  @IsString()
  findingsText?: string;

  @IsOptional()
  @IsString()
  legalNotes?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  quickDamageTypes?: string[];

  @IsOptional()
  @IsIn(['SMALL', 'MEDIUM', 'LARGE'])
  quickDamageSize?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  expertOfficeId?: string;
}

export class UpdateRepairReportDto {
  @IsOptional()
  @IsString()
  reportDate?: string;

  @IsOptional()
  @IsString()
  inspectorName?: string;

  @IsOptional()
  @IsString()
  reporterName?: string;

  @IsOptional()
  @IsString()
  findingsText?: string;

  @IsOptional()
  @IsString()
  legalNotes?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  quickDamageTypes?: string[];

  @IsOptional()
  @IsIn(['SMALL', 'MEDIUM', 'LARGE'])
  quickDamageSize?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  buildingDamageTotal?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  goodsDamageTotal?: number;
}

export class CreateReportItemDto {
  @IsString()
  workGroupId!: string;

  @IsOptional()
  @IsString()
  damageTypeId?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsString()
  jobDescription!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Type(() => Number)
  quantity!: number;

  @IsString()
  unit!: string;

  @IsNumber()
  @Type(() => Number)
  supplierUnitPrice!: number;

  @IsNumber()
  @Type(() => Number)
  salesUnitPrice!: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  sortOrder?: number;

  @IsOptional()
  @IsObject()
  metrajData?: Record<string, unknown>;

  @IsOptional()
  @IsIn(['unit', 'lumpsum'])
  pricingType?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  lumpSumPrice?: number;

  @IsOptional()
  @IsBoolean()
  materialIncluded?: boolean;

  @IsOptional()
  @IsBoolean()
  laborIncluded?: boolean;

  @IsOptional()
  @IsIn(['bina', 'esya'])
  damageCategory?: string;
}

export class UpdateReportItemDto {
  @IsOptional()
  @IsString()
  workGroupId?: string;

  @IsOptional()
  @IsString()
  damageTypeId?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  jobDescription?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  quantity?: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  supplierUnitPrice?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  salesUnitPrice?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  sortOrder?: number;

  @IsOptional()
  @IsObject()
  metrajData?: Record<string, unknown>;

  @IsOptional()
  @IsIn(['unit', 'lumpsum'])
  pricingType?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  lumpSumPrice?: number;

  @IsOptional()
  @IsBoolean()
  materialIncluded?: boolean;

  @IsOptional()
  @IsBoolean()
  laborIncluded?: boolean;

  @IsOptional()
  @IsIn(['bina', 'esya'])
  damageCategory?: string;
}

export class CreateDamageTypeDto {
  @IsString()
  damageTypeCode!: string;

  @IsString()
  damageTypeName!: string;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

export class SendEmailDto {
  @IsString()
  to!: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsIn(['internal', 'external'])
  viewType!: 'internal' | 'external';
}

export class QuickRepairItemDto {
  @IsString()
  workSubGroupId!: string;

  @IsNumber()
  @Type(() => Number)
  quantity!: number;

  @IsOptional()
  @IsString()
  note?: string;
}

export class AddQuickRepairItemsDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  damageTypes?: string[];

  @IsOptional()
  @IsString()
  fileId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuickRepairItemDto)
  items!: QuickRepairItemDto[];
}
