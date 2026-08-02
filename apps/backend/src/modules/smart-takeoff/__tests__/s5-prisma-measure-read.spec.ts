import {
  mapElementsToSnapshots,
  PrismaMeasureReadAdapter,
  resolveLengthMm,
} from '../adapters/prisma-measure-read.adapter';
import { StructureElementTypes } from '../domain/domain.types';
import { buildPrismaSmElementRow } from './fixtures/s5-sm-fixtures';

describe('S5 — PrismaMeasureReadAdapter real SM data flow', () => {
  const claimFileId = 'cf-prisma-s5';

  function buildAdapter(elements: ReturnType<typeof buildPrismaSmElementRow>[]) {
    const prisma = {
      smartMeasureElement: {
        findMany: jest.fn().mockResolvedValue(elements),
      },
    };
    return { adapter: new PrismaMeasureReadAdapter(prisma as never), prisma };
  }

  it('listForClaimFile maps all supported SM element types', async () => {
    const elements = [
      buildPrismaSmElementRow({ id: 'el-door', elementType: 'kapi', widthMm: 2100, heightMm: 900 }),
      buildPrismaSmElementRow({
        id: 'el-window',
        elementType: 'pvc_dograma',
        widthMm: 1200,
        heightMm: 1400,
      }),
      buildPrismaSmElementRow({
        id: 'el-ceiling',
        elementType: 'asma_tavan',
        widthMm: 4000,
        heightMm: 3500,
      }),
      buildPrismaSmElementRow({
        id: 'el-skirt',
        elementType: 'duvar',
        extensionJson: { metrajElementType: 'supurgelik', lengthMm: 4200 },
      }),
    ];
    const { adapter, prisma } = buildAdapter(elements);

    const snapshots = await adapter.listForClaimFile(claimFileId);

    expect(prisma.smartMeasureElement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          claimFileId,
          archivedAt: null,
          status: { not: 'archived' },
        }),
      }),
    );
    expect(snapshots).toHaveLength(4);
    expect(snapshots.map((s) => s.structureElementType)).toEqual([
      StructureElementTypes.DOOR,
      StructureElementTypes.WINDOW,
      StructureElementTypes.CEILING,
      StructureElementTypes.SKIRTING,
    ]);
    expect(snapshots[3].lengthMm).toBe(4200);
  });

  it('listByElementIds queries by id without loading full claim file', async () => {
    const elements = [
      buildPrismaSmElementRow({ id: 'el-door', elementType: 'kapi', widthMm: 2100, heightMm: 900 }),
    ];
    const { adapter, prisma } = buildAdapter(elements);

    await adapter.listByElementIds(claimFileId, ['el-door']);

    expect(prisma.smartMeasureElement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          claimFileId,
          id: { in: ['el-door'] },
        }),
      }),
    );
  });

  it('skips elements without version or unsupported type', async () => {
    const elements = [
      buildPrismaSmElementRow({ id: 'el-no-ver', elementType: 'kapi', noVersion: true }),
      buildPrismaSmElementRow({ id: 'el-diger', elementType: 'diger', widthMm: 1000, heightMm: 1000 }),
      buildPrismaSmElementRow({ id: 'el-door', elementType: 'kapi', widthMm: 2100, heightMm: 900 }),
    ];
    const { adapter } = buildAdapter(elements);

    const snapshots = await adapter.listForClaimFile(claimFileId);
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].measureElementId).toBe('el-door');
  });

  it('mapElementsToSnapshots resolves skirting length from perimeterMm', () => {
    const snapshots = mapElementsToSnapshots(
      [
        buildPrismaSmElementRow({
          id: 'el-skirt-perim',
          elementType: 'supurgelik',
          extensionJson: { perimeterMm: 3600 },
        }),
      ],
      claimFileId,
    );

    expect(snapshots[0].lengthMm).toBe(3600);
  });

  it('resolveLengthMm uses depthMm fallback for skirting', () => {
    const length = resolveLengthMm(StructureElementTypes.SKIRTING, {
      widthMm: null,
      heightMm: 100,
      depthMm: 2800,
      extensionJson: null,
    });
    expect(length).toBe(2800);
  });

  it('returns empty array for listByElementIds with empty ids', async () => {
    const { adapter, prisma } = buildAdapter([]);
    const result = await adapter.listByElementIds(claimFileId, []);
    expect(result).toEqual([]);
    expect(prisma.smartMeasureElement.findMany).not.toHaveBeenCalled();
  });
});
