import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectLeaveRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  rejectionReason?: string;
}
