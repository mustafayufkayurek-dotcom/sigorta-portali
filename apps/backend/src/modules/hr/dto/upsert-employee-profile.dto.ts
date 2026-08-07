import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export const HR_BLOOD_TYPES = [
  '0 Rh-',
  '0 Rh+',
  'A Rh-',
  'A Rh+',
  'B Rh-',
  'B Rh+',
  'AB Rh-',
  'AB Rh+',
] as const;

export type HrBloodType = (typeof HR_BLOOD_TYPES)[number];

export class UpsertEmployeeProfileDto {
  @IsUUID()
  userId!: string;

  @IsOptional()
  @IsDateString()
  hireDate?: string | null;

  /** Sicil No — özlük kartında zorunlu */
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  personnelNo!: string;

  /** T.C. Kimlik No */
  @IsString()
  @Matches(/^\d{11}$/, { message: 'T.C. Kimlik No 11 haneli olmalıdır' })
  identityNo!: string;

  /** Doğum Tarihi */
  @IsDateString()
  birthDate!: string;

  /** Kişisel GSM No */
  @IsString()
  @MinLength(10)
  @MaxLength(20)
  personalGsm!: string;

  /** Şirket GSM No */
  @IsString()
  @MinLength(10)
  @MaxLength(20)
  companyGsm!: string;

  /** Kan Grubu */
  @IsString()
  @IsIn([...HR_BLOOD_TYPES])
  bloodType!: HrBloodType;

  /** Görevi — sistem rolü (kullanıcıya atanır) */
  @IsUUID()
  roleId!: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string | null;

  @IsOptional()
  @IsUUID()
  managerUserId?: string | null;
}
