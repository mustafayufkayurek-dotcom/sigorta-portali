import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateLeaveRequestDto {
  /** Ayarlar → Tanımlar → Personel üzerinden yapılandırılabilir izin türü kodu; geçerlilik servis katmanında doğrulanır. */
  @IsString()
  @MaxLength(60)
  leaveType!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;

  /** true ise doğrudan onaya gönderilir; false ise taslak kalır */
  @IsOptional()
  submit?: boolean;
}
