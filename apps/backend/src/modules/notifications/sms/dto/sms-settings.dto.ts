import { IsString, IsBoolean, IsOptional, IsNotEmpty, MaxLength } from 'class-validator';

export class UpdateMessageTemplateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  content!: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class TestSmsDto {
  @IsString()
  @IsNotEmpty()
  to!: string;

  @IsString()
  @IsOptional()
  message?: string;
}
