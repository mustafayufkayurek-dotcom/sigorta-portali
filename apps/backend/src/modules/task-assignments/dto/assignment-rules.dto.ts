import { IsString, IsOptional, IsBoolean, IsInt, Min } from 'class-validator';

export class CreateAssignmentRuleDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  workGroupId?: string;

  @IsOptional()
  @IsString()
  serviceRegionId?: string;

  @IsString()
  assignToUserId!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateAssignmentRuleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  workGroupId?: string;

  @IsOptional()
  @IsString()
  serviceRegionId?: string;

  @IsOptional()
  @IsString()
  assignToUserId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
