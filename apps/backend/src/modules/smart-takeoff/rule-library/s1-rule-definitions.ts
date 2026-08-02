/**
 * S1 Rule Library — declarative operation knowledge (not math, not Nest controllers).
 * Reusable Platform First: definitions are data; future Capabilities hydrate via RuleFactory.
 *
 * Scope lock: DOOR · WINDOW · SKIRTING · CEILING only. No ceramic/parquet/cabinet rules.
 */

import {
  CalculationKeys,
  OperationItemCodes,
  StructureElementTypes,
} from '../domain/domain.types';
import type { PlannedOperationItem } from '../rule-engine/rule-result';

export interface RuleDefinition {
  readonly code: string;
  readonly structureElementType: string;
  readonly displayFamily: string;
  readonly plannedItems: readonly PlannedOperationItem[];
  /** Required measure fields for a match (no invented dimensions). */
  readonly requiredDimensions: readonly ('widthMm' | 'heightMm' | 'lengthMm')[];
}

export const S1_RULE_VERSION_TAG = 's1.2026.08.02.1';

export const S1_RULE_DEFINITIONS: readonly RuleDefinition[] = [
  {
    code: 'DOOR_PAINTING_SET',
    structureElementType: StructureElementTypes.DOOR,
    displayFamily: 'Kapı Boyama',
    requiredDimensions: ['widthMm', 'heightMm'],
    plannedItems: [
      {
        operationItemCode: OperationItemCodes.DOOR_PUTTY,
        displayName: 'Kapı Macun',
        unit: 'm2',
        calculationKey: CalculationKeys.AREA_M2_FROM_WXH,
      },
      {
        operationItemCode: OperationItemCodes.DOOR_PRIMER,
        displayName: 'Kapı Astar',
        unit: 'm2',
        calculationKey: CalculationKeys.AREA_M2_FROM_WXH,
      },
      {
        operationItemCode: OperationItemCodes.DOOR_SANDING,
        displayName: 'Kapı Zımpara',
        unit: 'm2',
        calculationKey: CalculationKeys.AREA_M2_FROM_WXH,
      },
      {
        operationItemCode: OperationItemCodes.DOOR_PAINT_COAT,
        displayName: 'Kapı Boya',
        unit: 'm2',
        calculationKey: CalculationKeys.AREA_M2_FROM_WXH_WITH_COATS,
        calculationParams: { coats: 2 },
      },
    ],
  },
  {
    code: 'WINDOW_PAINTING_SET',
    structureElementType: StructureElementTypes.WINDOW,
    displayFamily: 'Pencere Boyama',
    requiredDimensions: ['widthMm', 'heightMm'],
    plannedItems: [
      {
        operationItemCode: OperationItemCodes.WINDOW_PRIMER,
        displayName: 'Pencere Astar',
        unit: 'm2',
        calculationKey: CalculationKeys.AREA_M2_FROM_WXH,
      },
      {
        operationItemCode: OperationItemCodes.WINDOW_PAINT_COAT,
        displayName: 'Pencere Boya',
        unit: 'm2',
        calculationKey: CalculationKeys.AREA_M2_FROM_WXH_WITH_COATS,
        calculationParams: { coats: 2 },
      },
    ],
  },
  {
    code: 'SKIRTING_INSTALL_SET',
    structureElementType: StructureElementTypes.SKIRTING,
    displayFamily: 'Süpürgelik Döşeme',
    requiredDimensions: ['lengthMm'],
    plannedItems: [
      {
        operationItemCode: OperationItemCodes.SKIRTING_INSTALL,
        displayName: 'Süpürgelik Döşeme',
        unit: 'm_tul',
        calculationKey: CalculationKeys.LENGTH_M_FROM_MM,
      },
    ],
  },
  {
    code: 'CEILING_PAINTING_SET',
    structureElementType: StructureElementTypes.CEILING,
    displayFamily: 'Tavan Boyama',
    requiredDimensions: ['widthMm', 'heightMm'],
    plannedItems: [
      {
        operationItemCode: OperationItemCodes.CEILING_PRIMER,
        displayName: 'Tavan Astar',
        unit: 'm2',
        calculationKey: CalculationKeys.AREA_M2_FROM_WXH,
      },
      {
        operationItemCode: OperationItemCodes.CEILING_PAINT_COAT,
        displayName: 'Tavan Boya',
        unit: 'm2',
        calculationKey: CalculationKeys.AREA_M2_FROM_WXH_WITH_COATS,
        calculationParams: { coats: 2 },
      },
    ],
  },
];
