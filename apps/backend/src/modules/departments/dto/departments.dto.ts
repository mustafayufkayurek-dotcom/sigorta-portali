import { IsString, IsOptional, IsNumber, IsBoolean } from 'class-validator';

export class CreateDepartmentDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsString()
  reportFormat!: string;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

export class UpdateDepartmentDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  reportFormat?: string;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @IsString()
  status?: string;
}

export class CreateFileSubjectDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

export class UpdateFileSubjectDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @IsString()
  status?: string;
}

export class UpsertFieldConfigDto {
  @IsString()
  reportFormat!: string;

  @IsString()
  fieldKey!: string;

  @IsString()
  fieldLabel!: string;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}
