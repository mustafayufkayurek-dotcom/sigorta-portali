import { IsString, IsNotEmpty, IsOptional, Length, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class VerifyIdentityDto {
  @IsString()
  @IsNotEmpty()
  @Length(11, 11)
  tcNo!: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(2100)
  birthYear?: number;
}
