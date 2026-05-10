import { IsString, IsIn, IsNotEmpty } from 'class-validator';

export class CreateFileDocumentDto {
  @IsIn(['claim_file', 'emergency_case'])
  entityType!: string;

  @IsString()
  @IsNotEmpty()
  entityId!: string;

  @IsIn(['muvafakatname', 'matbu_evrak'])
  documentKind!: string;
}

export class SendWhatsappDto {
  @IsString()
  @IsNotEmpty()
  phone!: string;
}

export class ApproveFileDocumentDto {
  @IsString()
  @IsNotEmpty()
  fullName!: string;
}
