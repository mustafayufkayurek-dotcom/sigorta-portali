export class CreateExpenseDto {
  date!: string;
  amount!: number;
  vatRate?: number;
  vatIncluded?: boolean;
  description?: string;
  expenseGroup!: string;
  expenseSubgroup!: string;
  expensePlan?: string;
  operationSubject?: string;
  fileCaseId?: string;
  receiptImageUrl?: string;
  weekNumber?: number;
}

export class UpdateExpenseDto {
  date?: string;
  amount?: number;
  vatRate?: number;
  vatIncluded?: boolean;
  description?: string;
  expenseGroup?: string;
  expenseSubgroup?: string;
  expensePlan?: string;
  operationSubject?: string;
  fileCaseId?: string;
  receiptImageUrl?: string;
  weekNumber?: number;
}

export class ExpenseFilterDto {
  dateFrom?: string;
  dateTo?: string;
  expenseGroup?: string;
  approvalStatus?: string;
  operationSubject?: string;
  page?: number;
  limit?: number;
}
