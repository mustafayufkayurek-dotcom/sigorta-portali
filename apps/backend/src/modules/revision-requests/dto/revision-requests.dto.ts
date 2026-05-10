import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsUUID,
  MinLength,
} from 'class-validator';

export enum RevisionStatus {
  REQUESTED = 'REQUESTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
  ESCALATED = 'ESCALATED',
}

export enum RevisionPriority {
  NORMAL = 'NORMAL',
  URGENT = 'URGENT',
}

export enum RevisionReason {
  PRICE_CORRECTION = 'PRICE_CORRECTION',
  ITEM_ADD_REMOVE = 'ITEM_ADD_REMOVE',
  MEASUREMENT_FIX = 'MEASUREMENT_FIX',
  SCOPE_CHANGE = 'SCOPE_CHANGE',
  MISSING_DOCUMENT = 'MISSING_DOCUMENT',
  OTHER = 'OTHER',
}

export class CreateRevisionRequestDto {
  @IsUUID()
  reportId!: string;

  @IsOptional()
  @IsUUID()
  assignedToId?: string;

  @IsEnum(RevisionPriority)
  priority!: RevisionPriority;

  @IsEnum(RevisionReason)
  reason!: RevisionReason;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  reasonNote!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  affectedItems?: string[];

  @IsOptional()
  @IsDateString()
  deadlineAt?: string;
}

export class UpdateRevisionStatusDto {
  @IsEnum(RevisionStatus)
  status!: RevisionStatus;

  @IsOptional()
  @IsString()
  responseNote?: string;

  @IsOptional()
  @IsUUID()
  newReportId?: string;
}

export class ListRevisionRequestsDto {
  @IsOptional()
  @IsEnum(RevisionStatus)
  status?: RevisionStatus;

  @IsOptional()
  @IsUUID()
  reportId?: string;

  @IsOptional()
  @IsUUID()
  assignedToId?: string;

  @IsOptional()
  @IsEnum(RevisionPriority)
  priority?: RevisionPriority;
}

export class CreateRevisionMessageDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  message!: string;
}

export class StartRevisionDto {
  @IsOptional()
  @IsString()
  responseNote?: string;
}

export class CompleteRevisionDto {
  @IsUUID()
  newReportId!: string;

  @IsOptional()
  @IsString()
  responseNote?: string;
}
