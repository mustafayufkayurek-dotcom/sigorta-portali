import { IsBoolean, IsIn, IsISO8601, IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator';

export const OPERATIONAL_SCOPE_TYPES = ['hasar', 'acil_yardim', 'both'] as const;
export const OPERATIONAL_GRANT_TYPES = ['person_delegation', 'function_delegation'] as const;
export const OPERATIONAL_ACCESS_LEVELS = ['view', 'manage'] as const;

export type OperationalScopeType = (typeof OPERATIONAL_SCOPE_TYPES)[number];
export type OperationalGrantType = (typeof OPERATIONAL_GRANT_TYPES)[number];

export class CreateOperationalAccessGrantDto {
  @IsUUID()
  granteeUserId!: string;

  @ValidateIf((dto) => dto.grantType === 'person_delegation')
  @IsUUID()
  principalUserId?: string;

  @IsIn(OPERATIONAL_SCOPE_TYPES)
  scopeType!: OperationalScopeType;

  @IsIn(OPERATIONAL_GRANT_TYPES)
  grantType!: OperationalGrantType;

  @IsOptional()
  @IsIn(OPERATIONAL_ACCESS_LEVELS)
  accessLevel?: 'view' | 'manage';

  @IsISO8601()
  validFrom!: string;

  @IsOptional()
  @IsISO8601()
  validTo?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class DeactivateOperationalAccessGrantDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
