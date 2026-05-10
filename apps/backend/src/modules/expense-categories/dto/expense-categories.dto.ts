export class CreateExpenseCategoryDto {
  name!: string;
  code!: string;
  parentId?: string;
  sortOrder?: number;
}

export class UpdateExpenseCategoryDto {
  name?: string;
  sortOrder?: number;
  isActive?: boolean;
}
