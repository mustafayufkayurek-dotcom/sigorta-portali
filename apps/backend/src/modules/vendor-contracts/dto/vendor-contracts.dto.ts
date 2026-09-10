import { IsString, IsOptional, IsUUID, IsInt, IsBoolean, Min, IsDateString, IsIn } from 'class-validator';

export class CreateVendorContractDto {
  /** Hasar dosyası. Acil gönderiminde durmaz; XOR serviste. */
  @IsOptional()
  @IsString()
  claimFileId?: string;

  /** Acil Yardım dosyası. Hasar gönderiminde durmaz; XOR serviste. */
  @IsOptional()
  @IsString()
  emergencyCaseId?: string;

  @IsUUID()
  vendorId!: string;

  @IsOptional()
  @IsUUID()
  repairReportId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  deliveryDate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  signDeadlineDays?: number;

  /** simple/detailed alanı durur ama eşik uygulanmaz; metin her zaman tam sözleşmedir */
  @IsOptional()
  @IsIn(['simple', 'detailed'])
  kind?: 'simple' | 'detailed';

  /** Bu dosyaya özel metin; boşsa şablon üretilir */
  @IsOptional()
  @IsString()
  renderedContent?: string;
}

export class RequestVendorContractCorrectionDto {
  @IsString()
  note!: string;
}

export class UpdateVendorContractContentDto {
  @IsString()
  renderedContent!: string;
}

export class CreateClauseDto {
  @IsString()
  title!: string;

  @IsString()
  content!: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;
}

export class UpdateClauseDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;
}

export class ReorderClausesDto {
  @IsUUID(undefined, { each: true })
  ids!: string[];
}

export class SignContractDto {
  @IsString()
  fullName!: string;
}

export class SendWhatsappDto {
  @IsString()
  phone!: string;
}

export class UpdateTemplateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  version?: string;
}
