import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';
import { EMERGENCY_PROCESS_ACTIONS } from '../emergency-process-events';

export class RecordEmergencyProcessEventDto {
  @IsString()
  @IsIn([...EMERGENCY_PROCESS_ACTIONS])
  action!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
