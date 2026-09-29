import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRoleDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ enum: ['meridyen', 'dis'] })
  @IsString()
  @IsIn(['meridyen', 'dis'])
  accountFamily!: 'meridyen' | 'dis';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}
