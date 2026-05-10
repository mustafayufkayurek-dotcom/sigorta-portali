import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsIn } from 'class-validator';

export class CreateAgreementDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsString()
  @IsIn(['kvkk', 'gizlilik', 'is_sozlesmesi'])
  type!: string;

  @IsOptional()
  @IsString()
  version?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateAgreementDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  @IsIn(['kvkk', 'gizlilik', 'is_sozlesmesi'])
  type?: string;

  @IsOptional()
  @IsString()
  version?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AcceptAgreementDto {
  @IsString()
  @IsNotEmpty()
  agreementId!: string;

  @IsOptional()
  @IsString()
  signature?: string;
}
