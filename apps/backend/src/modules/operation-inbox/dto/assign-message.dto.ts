import { IsNotEmpty, IsString } from 'class-validator';

export class AssignMessageDto {
  @IsString()
  @IsNotEmpty({ message: 'Atanacak kullanıcı zorunludur' })
  assignedUserId!: string;
}
