import { IsString, IsNotEmpty, IsOptional, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRoleDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z_]+$/, { message: 'Kod yalnızca büyük harf ve alt çizgi içerebilir' })
  code!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}
