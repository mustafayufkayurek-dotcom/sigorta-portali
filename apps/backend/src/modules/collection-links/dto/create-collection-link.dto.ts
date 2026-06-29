import { IsEmail, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateCollectionLinkDto {
  @IsUUID()
  claimFileId!: string;

  @IsOptional()
  @IsUUID()
  revenueId?: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  payerName?: string;

  @IsOptional()
  @IsString()
  payerPhone?: string;

  @IsOptional()
  @IsEmail()
  payerEmail?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
