import { IsString, IsNotEmpty, Length } from 'class-validator';

export class VerifyIbanDto {
  @IsString()
  @IsNotEmpty()
  @Length(15, 34)
  iban!: string;
}
