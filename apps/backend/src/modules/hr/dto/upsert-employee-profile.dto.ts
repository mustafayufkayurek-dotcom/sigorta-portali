import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

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
}
