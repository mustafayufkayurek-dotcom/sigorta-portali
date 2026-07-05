import { IsDateString, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { HR_LEAVE_TYPE } from '../hr.constants';

export class CreateLeaveRequestDto {
  @IsIn(Object.values(HR_LEAVE_TYPE))
  leaveType!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;

  /** true ise doğrudan onaya gönderilir; false ise taslak kalır */
  @IsOptional()
  submit?: boolean;
}
