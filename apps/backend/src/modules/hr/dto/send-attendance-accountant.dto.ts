import { IsEmail, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class SendAttendanceAccountantDto {
  @IsEmail({}, { message: 'Geçerli bir e-posta adresi girin' })
  to!: string;

  @IsInt()
  @Min(2020)
  @Max(2100)
  year!: number;

  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @IsOptional()
  @IsString()
  message?: string;
}
