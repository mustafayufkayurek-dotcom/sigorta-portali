import { IsString, IsOptional, IsEnum, IsNotEmpty, IsDateString } from 'class-validator';
import { EmergencyUrgency } from '@prisma/client';

export class CreateEmergencyCaseDto {
  @IsString()
  @IsNotEmpty()
  customerName!: string;

  @IsString()
  @IsOptional()
  customerPhone?: string;

  @IsString()
  @IsOptional()
  customerId?: string;

  @IsString()
  @IsNotEmpty()
  fileNo!: string;

  @IsString()
  @IsNotEmpty()
  address!: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  district?: string;

  @IsString()
  @IsNotEmpty()
  issueType!: string;

  @IsDateString()
  @IsNotEmpty()
  fileDate!: string;

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
  @IsNotEmpty({ message: 'Tespit Bulguları zorunludur.' })
  findingsText!: string;
}
