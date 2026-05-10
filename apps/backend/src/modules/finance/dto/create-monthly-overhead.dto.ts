import {
  IsInt,
  IsNumber,
  IsPositive,
  IsString,
  IsNotEmpty,
  IsOptional,
  Min,
  Max,
  IsIn,
} from 'class-validator';

export class CreateMonthlyOverheadEntryDto {
  @IsInt()
  @Min(2020)
  @Max(2099)
  year!: number;

  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @IsString()
  @IsNotEmpty()
  expenseCategoryId!: string;

  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['manual', 'logo_erp'])
  source?: string;

  @IsOptional()
  @IsString()
  logoEntryRef?: string;
}

export class AllocateOverheadDto {
  @IsInt()
  @Min(2020)
  year!: number;

  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @IsIn(['equal', 'proportional_revenue', 'hybrid'])
  allocationMethod!: 'equal' | 'proportional_revenue' | 'hybrid';
}
