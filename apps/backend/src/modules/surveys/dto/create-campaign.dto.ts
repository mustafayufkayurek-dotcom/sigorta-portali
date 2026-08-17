import { IsString, IsOptional } from 'class-validator';

export class CreateCampaignDto {
  @IsString()
  invoiceRequestId!: string;

  @IsOptional()
  @IsString()
  insuredPhone?: string;
}
