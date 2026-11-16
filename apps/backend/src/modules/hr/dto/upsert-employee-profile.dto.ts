import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpsertEmployeeProfileDto {
  @IsUUID()
  userId!: string;

  @IsOptional()
  @IsDateString()
  hireDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  personnelNo?: string | null;

  @IsOptional()
  @IsUUID()
  departmentId?: string | null;

  @IsOptional()
  @IsUUID()
  managerUserId?: string | null;

  @IsOptional()
  @IsUUID()
  roleId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(11)
  identityNo?: string | null;

  @IsOptional()
  @IsDateString()
  birthDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  personalGsm?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  companyGsm?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  bloodType?: string | null;

  /** Aylık brüt ücret (TL) — C8 yasal hesap */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10_000_000)
  @Type(() => Number)
  monthlyGrossSalary?: number | null;
}
