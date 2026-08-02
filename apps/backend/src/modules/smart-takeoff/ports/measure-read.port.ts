/**
 * Smart Measurement read port.
 * S1: fixture / in-memory adapter only — Smart Measures module is NOT modified.
 */

export const MEASURE_READ_PORT = Symbol('MEASURE_READ_PORT');

export interface MeasureReadSnapshot {
  measureElementId: string;
  measureVersionId: string;
  structureElementType: string;
  /** Raw dimensions in mm (SM contract). */
  widthMm?: number | null;
  heightMm?: number | null;
  lengthMm?: number | null;
  claimFileId: string;
}

export interface MeasureReadPort {
  listForClaimFile(claimFileId: string): Promise<MeasureReadSnapshot[]>;
  listByElementIds?(claimFileId: string, elementIds: string[]): Promise<MeasureReadSnapshot[]>;
}

/** In-memory adapter for S1 vertical-slice tests and local runs. */
export class InMemoryMeasureReadPort implements MeasureReadPort {
  constructor(private readonly measures: MeasureReadSnapshot[] = []) {}

  async listForClaimFile(claimFileId: string): Promise<MeasureReadSnapshot[]> {
    return this.measures.filter((m) => m.claimFileId === claimFileId);
  }

  async listByElementIds(
    claimFileId: string,
    elementIds: string[],
  ): Promise<MeasureReadSnapshot[]> {
    if (elementIds.length === 0) return [];
    const idSet = new Set(elementIds);
    return this.measures.filter(
      (m) => m.claimFileId === claimFileId && idSet.has(m.measureElementId),
    );
  }
}
