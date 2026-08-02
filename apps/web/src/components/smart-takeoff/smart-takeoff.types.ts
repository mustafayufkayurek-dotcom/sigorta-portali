export type TakeoffCalculationStep = {
  order: number;
  label: string;
  input?: unknown;
  output?: unknown;
};

export type TakeoffManualOverride = {
  id: string;
  quantityEnginePreserved: number;
  quantityOverride: number;
  reason: string;
  createdAt: string;
  createdByUserId: string;
  active: boolean;
};

export type TakeoffLineItem = {
  id: string;
  operationItemCode: string;
  displayName: string;
  structureElementType: string;
  sourceMeasureElementId: string | null;
  unit: string;
  quantityEngine: number;
  quantityFinal: number;
  hasOverride: boolean;
  ruleCode: string;
  ruleVersionTag: string;
  sortOrder: number;
  explanation: {
    measureSummary: string;
    humanReadableText: string;
    decisionPath: string[];
    calculationSteps: TakeoffCalculationStep[];
    overrideSummary?: string | null;
  };
  overrides: TakeoffManualOverride[];
};

export type TakeoffRun = {
  id: string;
  claimFileId: string;
  runNumber: number;
  ruleVersionTag: string;
  status: string;
  note: string | null;
  createdAt: string;
  lineItemCount: number;
  lineItems: TakeoffLineItem[];
};
