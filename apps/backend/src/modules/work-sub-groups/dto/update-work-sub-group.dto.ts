import { IsString, IsOptional, IsNumber, IsIn, MaxLength, Min, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateWorkSubGroupDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  unitType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: string;

  @IsOptional()
  @IsUUID('4')
  workGroupId?: string;
}
