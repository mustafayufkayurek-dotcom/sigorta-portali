import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReplyMessageDto {
  @IsString()
  @IsNotEmpty({ message: 'Yanıt metni zorunludur' })
  @MaxLength(50_000, { message: 'Yanıt metni en fazla 50.000 karakter olabilir' })
  body!: string;

  @IsOptional()
  @IsBoolean()
  replyAll?: boolean;
}
