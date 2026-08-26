import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class SendExternalApprovalDto {
  @IsIn(['expert', 'insurance_company'])
  approverType!: 'expert' | 'insurance_company';

  @IsOptional()
  @IsString()
  approverId?: string;

  @IsOptional()
  @IsString()
  approverName?: string;

  @IsOptional()
  @IsString()
  approverEmail?: string;

  @IsOptional()
  @IsString()
  approverPhone?: string;

  @IsIn(['email', 'whatsapp', 'in_app'])
  channel!: 'email' | 'whatsapp' | 'in_app';

  /** Saat cinsinden geçerlilik süresi, varsayılan 72 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(720)
  expiresInHours?: number;
}

export class RespondExternalApprovalDto {
  @IsIn(['approved', 'rejected'])
  action!: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  comments?: string;
}
