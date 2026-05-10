import { IsString, IsOptional, IsUUID, IsInt, IsBoolean, Min, IsDateString } from 'class-validator';

export class CreateVendorContractDto {
  @IsUUID()
  claimFileId!: string;

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
