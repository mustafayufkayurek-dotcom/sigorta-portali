import { IsArray, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateTakeoffRunDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  /** Boş bırakılırsa dosyadaki tüm uygun SM ölçüleri kullanılır. */
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  measureElementIds?: string[];
}

export class TakeoffLineItemResponseDto {
  id!: string;
  operationItemCode!: string;
  displayName!: string;
  structureElementType!: string;
  sourceMeasureElementId!: string | null;
  unit!: string;
  quantityEngine!: number;
  quantityFinal!: number;
  ruleCode!: string;
  ruleVersionTag!: string;
  sortOrder!: number;
  explanation!: {
    measureSummary: string;
    humanReadableText: string;
    decisionPath: string[];
    calculationSteps: Array<{ order: number; label: string; input?: unknown; output?: unknown }>;
  };
}

export class TakeoffRunResponseDto {
  id!: string;
  claimFileId!: string;
  runNumber!: number;
  ruleVersionTag!: string;
  status!: string;
  note!: string | null;
  createdAt!: string;
  lineItemCount!: number;
  lineItems!: TakeoffLineItemResponseDto[];
}
