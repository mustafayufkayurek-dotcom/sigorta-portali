import { IsNotEmpty, IsString } from 'class-validator';

export class LinkClaimFileDto {
  @IsString()
  @IsNotEmpty({ message: 'Hasar dosyası kimliği zorunludur' })
  claimFileId!: string;
}
