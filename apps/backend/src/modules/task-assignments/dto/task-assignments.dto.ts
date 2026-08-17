import { IsString, IsOptional, IsEnum, IsBoolean, IsInt, IsDateString, IsArray, Min } from 'class-validator';

export enum TaskAssignmentStatus {
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
  TIMEOUT_AUTO_ASSIGNED = 'TIMEOUT_AUTO_ASSIGNED',
}

export enum TaskAssignmentPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export class CreateTaskAssignmentDto {
  @IsString()
  claimFileId!: string;

  @IsString()
  assignedToId!: string;

  @IsOptional()
  @IsString()
  assignedById?: string;

  @IsOptional()
  @IsEnum(TaskAssignmentPriority)
  priority?: TaskAssignmentPriority;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  timeoutHours?: number;

  @IsOptional()
  @IsBoolean()
  autoAssigned?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class FilterTaskAssignmentsDto {
  @IsOptional()
  @IsEnum(TaskAssignmentStatus)
  status?: TaskAssignmentStatus;

  @IsOptional()
  @IsString()
  assignedToId?: string;

  @IsOptional()
  @IsString()
  claimFileId?: string;

  @IsOptional()
  @IsEnum(TaskAssignmentPriority)
  priority?: TaskAssignmentPriority;
}

export class RejectTaskAssignmentDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

export class BulkApproveDto {
  @IsArray()
  @IsString({ each: true })
  ids!: string[];
}

export class AutoAssignDto {
  @IsString()
  claimFileId!: string;

  @IsOptional()
  @IsString()
  workGroupId?: string;

  @IsOptional()
  @IsString()
  regionId?: string;

  @IsOptional()
  @IsString()
  assignedById?: string;
}

export interface EscalationRules {
  warningDays: number;
  criticalDays: number;
  escalationDays: number;
}
