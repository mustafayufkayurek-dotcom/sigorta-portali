import { IsString, IsOptional } from 'class-validator';

export class CreateWaitingDto {
  @IsString()
  reason!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateTimelineNoteDto {
  @IsString()
  content!: string;

  @IsOptional()
  @IsString()
  noteType?: string; // general | operations | finance | adjuster | field
}
