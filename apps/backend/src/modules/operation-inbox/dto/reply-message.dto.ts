import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { INBOX_REPLY_ATTACH_MAX_FILES } from '@sigorta/shared';

export class ReplyAttachmentDto {
  @IsString()
  @IsNotEmpty({ message: 'Ek dosya adı zorunludur' })
  @MaxLength(180, { message: 'Ek dosya adı çok uzun' })
  filename!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  contentType?: string;

  @IsString()
  @IsNotEmpty({ message: 'Ek içeriği zorunludur' })
  contentBase64!: string;
}

export class RecipientCardHintsDto {
  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true, message: 'Geçerli e-posta girin' })
  emails?: string[];

  @IsOptional()
  @IsString()
  messageId?: string;

  @IsOptional()
  @IsString()
  claimFileId?: string;

  @IsOptional()
  @IsString()
  emergencyCaseId?: string;
}

export class ReplyMessageDto {
  @IsString()
  @IsNotEmpty({ message: 'Yanıt metni zorunludur' })
  @MaxLength(50_000, { message: 'Yanıt metni en fazla 50.000 karakter olabilir' })
  body!: string;

  @IsOptional()
  @IsBoolean()
  replyAll?: boolean;

  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true, message: 'Kime için geçerli e-posta girin' })
  extraTo?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(INBOX_REPLY_ATTACH_MAX_FILES, {
    message: `En fazla ${INBOX_REPLY_ATTACH_MAX_FILES} ek ekleyebilirsiniz`,
  })
  @ValidateNested({ each: true })
  @Type(() => ReplyAttachmentDto)
  attachments?: ReplyAttachmentDto[];
}
