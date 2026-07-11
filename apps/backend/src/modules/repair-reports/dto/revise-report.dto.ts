import { IsArray, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { RevisionReason } from '../../revision-requests/dto/revision-requests.dto';

export class ReviseReportDto {
  @IsOptional()
  @IsEnum(RevisionReason)
  reason?: RevisionReason;

  @IsOptional()
  @IsString()
  @MinLength(10)
  reasonNote?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  affectedSections?: string[];
}
