import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateExpenseDto {
  @IsDateString()
  date!: string;

  @IsNumber()
  @Type(() => Number)
  amount!: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  vatRate?: number;

  @IsOptional()
  @IsBoolean()
  vatIncluded?: boolean;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  expenseGroup?: string;

  @IsOptional()
  @IsString()
  expenseSubgroup?: string;

  @IsOptional()
  @IsString()
  expenseCategoryId?: string;

  @IsOptional()
  @IsString()
  expensePlan?: string;

  @IsOptional()
  @IsString()
  operationSubject?: string;

  @IsOptional()
  @IsString()
  fileCaseId?: string;

  @IsOptional()
  @IsString()
  receiptImageUrl?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  weekNumber?: number;
}

export class UpdateExpenseDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  amount?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  vatRate?: number;

  @IsOptional()
  @IsBoolean()
  vatIncluded?: boolean;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  expenseGroup?: string;

  @IsOptional()
  @IsString()
  expenseSubgroup?: string;

  @IsOptional()
  @IsString()
  expenseCategoryId?: string;

  @IsOptional()
  @IsString()
  expensePlan?: string;

  @IsOptional()
  @IsString()
  operationSubject?: string;

  @IsOptional()
  @IsString()
  fileCaseId?: string;

  @IsOptional()
  @IsString()
  receiptImageUrl?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  weekNumber?: number;
}

export class ExpenseFilterDto {
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  expenseGroup?: string;

  @IsOptional()
  @IsString()
  expensePlan?: string;

  @IsOptional()
  @IsString()
  fileCaseId?: string;

  @IsOptional()
  @IsString()
  approvalStatus?: string;

  @IsOptional()
  @IsString()
  operationSubject?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  limit?: number;
}
