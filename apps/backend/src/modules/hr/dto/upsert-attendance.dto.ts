import { IsDateString, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { HR_ATTENDANCE_STATUS } from '../hr.constants';

export class UpsertAttendanceDto {
  @IsDateString()
  workDate!: string;

  @IsOptional()
  @IsIn(Object.values(HR_ATTENDANCE_STATUS))
  attendanceStatus?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  minutesWorked?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  /** ISO 8601 — manuel mesai giriş saati */
  @IsOptional()
  @IsString()
  clockInAt?: string;

  /** ISO 8601 — manuel mesai bitiş saati */
  @IsOptional()
  @IsString()
  clockOutAt?: string;
}
