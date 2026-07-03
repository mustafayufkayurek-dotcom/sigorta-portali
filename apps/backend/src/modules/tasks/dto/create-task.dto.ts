import { IsDateString, IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

const TASK_TYPES = [
  'reminder',
  'follow_up',
  'call',
  'document',
  'closure',
  'other',
  'document_collection',
  'expert_assignment',
  'site_visit',
  'collection_followup',
  'appointment',
  'repair_tracking',
] as const;

const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;

export class CreateTaskDto {
  @IsUUID()
  claimFileId!: string;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsIn(TASK_TYPES)
  taskType!: string;

  @IsIn(PRIORITIES)
  priority!: string;

  @IsOptional()
  @IsUUID()
  assignedUserId?: string;

  @IsOptional()
  @IsDateString()
  dueAt?: string;
}
