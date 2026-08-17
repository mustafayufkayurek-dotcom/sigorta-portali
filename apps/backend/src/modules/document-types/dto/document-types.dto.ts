import { IsString, IsOptional, IsBoolean, IsInt, IsNotEmpty, IsArray, IsUUID, IsIn } from 'class-validator';

export class CreateDocumentTypeDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  serviceTypeIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  departmentIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serviceBranchTypes?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  customerSubTypes?: string[];

  @IsOptional()
  @IsIn(['vendor', 'customer'])
  entityScope?: string;
}

export class UpdateDocumentTypeDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  serviceTypeIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  departmentIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serviceBranchTypes?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  customerSubTypes?: string[];

  @IsOptional()
  @IsIn(['vendor', 'customer'])
  entityScope?: string;
}
