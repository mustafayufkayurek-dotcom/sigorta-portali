import { IsOptional, IsString, IsIn, IsDateString, MaxLength } from 'class-validator';

export class UpdateExtraWorkItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString()
  @IsIn(['draft', 'approved', 'completed', 'cancelled'])
  status?: string;

  @IsOptional()
  @IsDateString()
  agreedAt?: string;

  @IsOptional()
  @IsDateString()
  completedAt?: string;
}
