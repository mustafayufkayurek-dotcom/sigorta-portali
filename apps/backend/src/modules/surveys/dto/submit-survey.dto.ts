import {
  IsInt,
  IsBoolean,
  IsOptional,
  IsString,
  Min,
  Max,
} from 'class-validator';

export class SubmitSurveyDto {
  @IsInt()
  @Min(1)
  @Max(5)
  q1Rating!: number;

  @IsInt()
  @Min(1)
  @Max(5)
  q2Rating!: number;

  @IsInt()
  @Min(1)
  @Max(5)
  q3Rating!: number;

  @IsInt()
  @Min(1)
  @Max(5)
  q4Rating!: number;

  @IsInt()
  @Min(1)
  @Max(5)
  q5Rating!: number;

  @IsBoolean()
  q6Recommend!: boolean;

  @IsOptional()
  @IsString()
  q7Comment?: string;
}
