import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RecordActivityBeatDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  lastRoute?: string;
}
