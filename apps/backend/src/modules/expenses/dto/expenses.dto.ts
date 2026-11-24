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

  /** false = belgesiz → KDV kayıp KDV’ye yazılır */
  @IsOptional()
  @IsBoolean()
  hasTaxDocument?: boolean;

  /** Kasa Fişi / Fatura — açıklamaya gömülmez */
  @IsOptional()
  @IsString()
  receiptDocumentType?: string;

  @IsOptional()
  @IsString()
  receiptDocumentNo?: string;

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
  customerId?: string;

  /** Ödeme / borç kaynağı cari (kredi kartı, tedarikçi vb.) */
  @IsOptional()
  @IsString()
  partyAccountId?: string;

  /** Rapordaki iş grubu — bütçe denetimi bu satır üzerinden */
  @IsOptional()
  @IsString()
  workGroupId?: string;

  @IsOptional()
  @IsString()
  workSubGroupName?: string;

  @IsOptional()
  @IsString()
  receiptImageUrl?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  weekNumber?: number;

  /**
   * Belge / dosya hakediş kontrol penceresinden «Farklı Belge — Devam» gerekçesi.
   * Çakışma varken zorunlu; audit izine yazılır.
   */
  @IsOptional()
  @IsString()
  documentConflictOverrideReason?: string;

  /** Acil dosya bağlamı — hakediş uyarısı için (opsiyonel; yoksa müşteri+tedarikçiden bulunur). */
  @IsOptional()
  @IsString()
  emergencyCaseId?: string;
}

export class ExpenseDocumentReviewDto {
  @IsOptional()
  @IsBoolean()
  hasTaxDocument?: boolean;

  @IsOptional()
  @IsString()
  receiptDocumentNo?: string;

  @IsOptional()
  @IsString()
  partyAccountId?: string;

  @IsOptional()
  @IsString()
  fileCaseId?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  operationSubject?: string;

  @IsOptional()
  @IsString()
  emergencyCaseId?: string;

  /** Güncellemede kendi kaydı eşleşmeden düşer. */
  @IsOptional()
  @IsString()
  excludeExpenseId?: string;
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
  @IsBoolean()
  hasTaxDocument?: boolean;

  @IsOptional()
  @IsString()
  receiptDocumentType?: string;

  @IsOptional()
  @IsString()
  receiptDocumentNo?: string;

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
  customerId?: string;

  @IsOptional()
  @IsString()
  partyAccountId?: string;

  @IsOptional()
  @IsString()
  workGroupId?: string;

  @IsOptional()
  @IsString()
  workSubGroupName?: string;

  @IsOptional()
  @IsString()
  receiptImageUrl?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  weekNumber?: number;

  @IsOptional()
  @IsString()
  documentConflictOverrideReason?: string;

  @IsOptional()
  @IsString()
  emergencyCaseId?: string;
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

  /** Gerçek masraf grubu (üst kategori) — alt grup kayıtları parentId ile bağlanır. */
  @IsOptional()
  @IsString()
  expenseCategoryParentId?: string;

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
