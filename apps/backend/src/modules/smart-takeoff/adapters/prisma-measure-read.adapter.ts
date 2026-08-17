import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { MeasureReadPort, MeasureReadSnapshot } from '../ports/measure-read.port';
import { StructureElementTypes } from '../domain/domain.types';
import { mapSmElementTypeToTakeoff } from './sm-structure-type.mapper';

const SM_ELEMENT_INCLUDE = {
  versions: { orderBy: { versionNo: 'desc' as const }, take: 1 },
} as const;

const SM_ACTIVE_WHERE = {
  archivedAt: null,
  status: { not: 'archived' as const },
} as const;

type SmElementRow = {
  id: string;
  elementType: string;
  versions: Array<{
    id: string;
    widthMm: number | null;
    heightMm: number | null;
    depthMm: number | null;
    extensionJson: unknown;
  }>;
};

/**
 * Reads latest Smart Measurement version per element (salt okuma).
 * Does not modify Smart Measures module.
 * Filter/order aligned with SmartMeasuresService.listForClaimFile.
 */
@Injectable()
export class PrismaMeasureReadAdapter implements MeasureReadPort {
  constructor(private readonly prisma: PrismaService) {}

  async listForClaimFile(claimFileId: string): Promise<MeasureReadSnapshot[]> {
    const elements = await this.prisma.smartMeasureElement.findMany({
      where: { claimFileId, ...SM_ACTIVE_WHERE },
      include: SM_ELEMENT_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });

    return mapElementsToSnapshots(elements, claimFileId);
  }

  async listByElementIds(
    claimFileId: string,
    elementIds: string[],
  ): Promise<MeasureReadSnapshot[]> {
    if (elementIds.length === 0) return [];

    const elements = await this.prisma.smartMeasureElement.findMany({
      where: {
        claimFileId,
        id: { in: elementIds },
        ...SM_ACTIVE_WHERE,
      },
      include: SM_ELEMENT_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });

    return mapElementsToSnapshots(elements, claimFileId);
  }
}

export function mapElementsToSnapshots(
  elements: SmElementRow[],
  claimFileId: string,
): MeasureReadSnapshot[] {
  const snapshots: MeasureReadSnapshot[] = [];

  for (const el of elements) {
    const version = el.versions[0];
    if (!version) continue;

    const structureElementType = mapSmElementTypeToTakeoff(
      el.elementType,
      version.extensionJson,
    );
    if (!structureElementType) continue;

    snapshots.push({
      measureElementId: el.id,
      measureVersionId: version.id,
      structureElementType,
      widthMm: version.widthMm,
      heightMm: version.heightMm,
      lengthMm: resolveLengthMm(structureElementType, version),
      claimFileId,
    });
  }

  return snapshots;
}

export function resolveLengthMm(
  structureElementType: string,
  version: {
    widthMm: number | null;
    heightMm: number | null;
    depthMm: number | null;
    extensionJson: unknown;
  },
): number | null | undefined {
  if (structureElementType !== StructureElementTypes.SKIRTING) {
    return undefined;
  }

  const ext = version.extensionJson as
    | { lengthMm?: number; perimeterMm?: number }
    | null
    | undefined;

  if (typeof ext?.lengthMm === 'number' && ext.lengthMm > 0) {
    return ext.lengthMm;
  }

  if (typeof ext?.perimeterMm === 'number' && ext.perimeterMm > 0) {
    return ext.perimeterMm;
  }

  // SM pratiği: koşu/uzunluk ölçüsü widthMm veya depthMm alanında tutulabilir
  if (version.widthMm != null && version.widthMm > 0 && version.heightMm == null) {
    return version.widthMm;
  }

  return version.widthMm ?? version.depthMm ?? null;
}
