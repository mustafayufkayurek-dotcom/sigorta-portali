import { Type } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class PatchPersonelUcretDto {
  @IsNumber()
  @Min(0)
  @Max(10_000_000)
  @Type(() => Number)
  monthlyGrossSalary!: number;
}

export class AcceptPersonelYasalHesapDto {
  @IsOptional()
  @IsInt()
  @Min(2020)
  @Max(2100)
  @Type(() => Number)
  year?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  month?: number;
}

export class SendPersonelYasalAccountantDto {
  @IsEmail({}, { message: 'Geçerli bir e-posta adresi girin' })
  to!: string;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsInt()
  @Min(2020)
  @Max(2100)
  @Type(() => Number)
  year?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  month?: number;
}
