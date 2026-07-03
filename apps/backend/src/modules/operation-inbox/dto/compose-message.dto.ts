import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { InboundMailbox } from '@prisma/client';

export class ComposeMessageDto {
  @IsEnum(InboundMailbox, { message: 'Geçerli bir paylaşımlı kutu seçin (IHBAR veya HASAR)' })
  mailbox!: InboundMailbox;

  @IsArray()
  @ArrayMinSize(1, { message: 'En az bir alıcı e-posta adresi gerekli' })
  @IsEmail({}, { each: true, message: 'Geçerli e-posta adresleri girin' })
  to!: string[];

  @IsString()
  @IsNotEmpty({ message: 'Konu zorunludur' })
  @MinLength(1)
  subject!: string;

  @IsString()
  @IsNotEmpty({ message: 'Mesaj metni zorunludur' })
  @MinLength(3, { message: 'Mesaj en az 3 karakter olmalıdır' })
  body!: string;

  @IsString()
  @IsOptional()
  claimFileId?: string;

  @IsString()
  @IsOptional()
  emergencyCaseId?: string;
}
