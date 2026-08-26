import { IsString, IsOptional, IsEnum, IsBoolean, IsNumber } from 'class-validator';
import { EmergencyUrgency } from '@prisma/client';

export class UpdateEmergencyCaseDto {
  @IsString()
  @IsOptional()
  customerName?: string;

  @IsString()
  @IsOptional()
  customerPhone?: string;

  @IsString()
  @IsOptional()
  customerId?: string;

  @IsString()
  @IsOptional()
  fileNo?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  district?: string;

  @IsString()
  @IsOptional()
  issueType?: string;

  @IsEnum(EmergencyUrgency)
  @IsOptional()
  urgency?: EmergencyUrgency;

  @IsString()
  @IsOptional()
  assignedVendorId?: string;

  @IsString()
  @IsOptional()
  assignedUserId?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  findingsText?: string;

  @IsBoolean()
  @IsOptional()
  vendorPaid?: boolean;

  @IsNumber()
  @IsOptional()
  latitude?: number | null;

  @IsNumber()
  @IsOptional()
  longitude?: number | null;
}
