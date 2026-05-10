import { IsEnum, IsNotEmpty } from 'class-validator';
import { EmergencyStatus } from '@prisma/client';

export class UpdateEmergencyStatusDto {
  @IsEnum(EmergencyStatus)
  @IsNotEmpty()
  status!: EmergencyStatus;
}
