import { IsNotEmpty, IsString } from 'class-validator';

export class LinkEmergencyFileDto {
  @IsString()
  @IsNotEmpty({ message: 'Acil yardım dosyası kimliği zorunludur' })
  emergencyCaseId!: string;
}
