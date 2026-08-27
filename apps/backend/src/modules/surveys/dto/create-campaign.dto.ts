import { IsString, IsOptional } from 'class-validator';

export class CreateCampaignDto {
  @IsOptional()
  @IsString()
  invoiceRequestId?: string;

  @IsOptional()
  @IsString()
  claimFileId?: string;

  @IsOptional()
  @IsString()
  emergencyCaseId?: string;

  @IsOptional()
  @IsString()
  insuredPhone?: string;
}
