/**
 * Smart Quantity Takeoff — Domain types.
 * SSOT: SMART_QUANTITY_TAKEOFF_MIMARI.md
 *
 * Reusable Platform First: stabil kodlar gelecek Capability bağları için
 * (Supplier Memory · Digital Twin · Repair Knowledge · AI Decision Support).
 */

/** Yapı elemanı tipi kimliği (Rule Library / Decision eşlemesi için stabil kod). */
export type StructureElementType = string;

/** Operasyon iş kalemi kodu (ileride Faz 3–5 bağları için stabil). */
export type OperationItemCode = string;

/** Metraj ara çıktı birimleri (UI dili ayrı katmanda). */
export type TakeoffUnit = 'm2' | 'm_tul' | 'adet' | 'm3' | string;

/**
 * Loose-coupling port markers for future modules.
 * Types only — no services for Operation Map / Twin / Supplier / Knowledge / AI.
 */
export type FutureExtensionSlot =
  | 'operation_map'
  | 'digital_twin'
  | 'supplier_intelligence'
  | 'repair_knowledge_library'
  | 'operation_analytics'
  | 'ai_operation_assistant';

/** S1 desteklenen yapı elemanları (ürün sahibi kapsamı). */
export const StructureElementTypes = {
  DOOR: 'DOOR',
  WINDOW: 'WINDOW',
  SKIRTING: 'SKIRTING',
  CEILING: 'CEILING',
} as const;

export type S1StructureElementType =
  (typeof StructureElementTypes)[keyof typeof StructureElementTypes];

/** S1 operasyon iş kalemi kodları — Rule Library şişirilmeden minimal set. */
export const OperationItemCodes = {
  DOOR_PUTTY: 'DOOR_PUTTY',
  DOOR_PRIMER: 'DOOR_PRIMER',
  DOOR_SANDING: 'DOOR_SANDING',
  DOOR_PAINT_COAT: 'DOOR_PAINT_COAT',
  WINDOW_PRIMER: 'WINDOW_PRIMER',
  WINDOW_PAINT_COAT: 'WINDOW_PAINT_COAT',
  SKIRTING_INSTALL: 'SKIRTING_INSTALL',
  CEILING_PRIMER: 'CEILING_PRIMER',
  CEILING_PAINT_COAT: 'CEILING_PAINT_COAT',
} as const;

/** Calculation strategy keys — Calculation Engine only; no decision semantics. */
export const CalculationKeys = {
  AREA_M2_FROM_WXH: 'area_m2_from_wxh',
  AREA_M2_FROM_WXH_WITH_COATS: 'area_m2_from_wxh_with_coats',
  LENGTH_M_FROM_MM: 'length_m_from_mm',
} as const;

export type CalculationKey = (typeof CalculationKeys)[keyof typeof CalculationKeys];
