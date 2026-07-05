import { IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export class ConfirmAttendanceDayDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  workDate!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  minutesWorked?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  clockInAt?: string;

  @IsOptional()
  @IsString()
  clockOutAt?: string;
}

export class ConfirmAttendanceMonthDto {
  @IsInt()
  @Min(2020)
  @Max(2100)
  year!: number;

  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  /** Ad-soyad yazarak dijital imza (F5b) */
  @IsString()
  signature!: string;
}
