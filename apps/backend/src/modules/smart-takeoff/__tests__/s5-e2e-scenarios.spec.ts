import { BadRequestException } from '@nestjs/common';
import {
  OperationItemCodes,
  StructureElementTypes,
} from '../domain/domain.types';
import { InMemoryMeasureReadPort } from '../ports/measure-read.port';
import {
  buildMultiElementMeasures,
  buildS5Service,
  S5_CLAIM_FILE_ID,
  S5_USER,
} from './fixtures/s5-sm-fixtures';

describe('S5 — E2E claim-file scenarios (realistic SM fixtures)', () => {
  it('produces door work items (4 line items per door)', async () => {
    const service = buildS5Service([
      {
        measureElementId: 'me-door',
        measureVersionId: 'mv-door',
        claimFileId: S5_CLAIM_FILE_ID,
        structureElementType: StructureElementTypes.DOOR,
        widthMm: 2100,
        heightMm: 900,
      },
    ]);

    const run = await service.createRun(S5_CLAIM_FILE_ID, S5_USER, { note: 'Kapı senaryosu' });

    expect(run.lineItemCount).toBe(4);
    expect(run.lineItems.map((li) => li.operationItemCode)).toEqual([
      OperationItemCodes.DOOR_PUTTY,
      OperationItemCodes.DOOR_PRIMER,
      OperationItemCodes.DOOR_SANDING,
      OperationItemCodes.DOOR_PAINT_COAT,
    ]);
    expect(run.lineItems[0].displayName).toBe('Kapı Macun');
    expect(run.lineItems[0].explanation.humanReadableText).toContain('Kapı');
  });

  it('produces window work items (2 line items)', async () => {
    const service = buildS5Service([
      {
        measureElementId: 'me-window',
        measureVersionId: 'mv-window',
        claimFileId: S5_CLAIM_FILE_ID,
        structureElementType: StructureElementTypes.WINDOW,
        widthMm: 1500,
        heightMm: 1200,
      },
    ]);

    const run = await service.createRun(S5_CLAIM_FILE_ID, S5_USER, {});

    expect(run.lineItemCount).toBe(2);
    expect(run.lineItems[0].operationItemCode).toBe(OperationItemCodes.WINDOW_PRIMER);
    expect(run.lineItems[1].operationItemCode).toBe(OperationItemCodes.WINDOW_PAINT_COAT);
  });

  it('produces ceiling work items (2 line items)', async () => {
    const service = buildS5Service([
      {
        measureElementId: 'me-ceiling',
        measureVersionId: 'mv-ceiling',
        claimFileId: S5_CLAIM_FILE_ID,
        structureElementType: StructureElementTypes.CEILING,
        widthMm: 5000,
        heightMm: 4000,
      },
    ]);

    const run = await service.createRun(S5_CLAIM_FILE_ID, S5_USER, {});

    expect(run.lineItemCount).toBe(2);
    expect(run.lineItems.every((li) => li.structureElementType === StructureElementTypes.CEILING)).toBe(
      true,
    );
  });

  it('produces skirting work item from lengthMm (extensionJson path)', async () => {
    const service = buildS5Service([
      {
        measureElementId: 'me-skirt',
        measureVersionId: 'mv-skirt',
        claimFileId: S5_CLAIM_FILE_ID,
        structureElementType: StructureElementTypes.SKIRTING,
        lengthMm: 4800,
      },
    ]);

    const run = await service.createRun(S5_CLAIM_FILE_ID, S5_USER, {});

    expect(run.lineItemCount).toBe(1);
    expect(run.lineItems[0].operationItemCode).toBe(OperationItemCodes.SKIRTING_INSTALL);
    expect(run.lineItems[0].quantityFinal).toBe(4.8);
    expect(run.lineItems[0].unit).toBe('m_tul');
  });

  it('multi-element claim file batches all supported types (9 line items)', async () => {
    const service = buildS5Service(buildMultiElementMeasures());

    const run = await service.createRun(S5_CLAIM_FILE_ID, S5_USER, {
      note: 'Çoklu eleman',
    });

    expect(run.lineItemCount).toBe(9);
    const types = new Set(run.lineItems.map((li) => li.structureElementType));
    expect(types).toEqual(
      new Set([
        StructureElementTypes.DOOR,
        StructureElementTypes.WINDOW,
        StructureElementTypes.CEILING,
        StructureElementTypes.SKIRTING,
      ]),
    );
  });

  it('createRun with measureElementIds subset processes only selected elements', async () => {
    const measures = buildMultiElementMeasures();
    const service = buildS5Service(measures);

    const run = await service.createRun(S5_CLAIM_FILE_ID, S5_USER, {
      measureElementIds: ['me-door-1', 'me-skirt-1'],
    });

    expect(run.lineItemCount).toBe(5);
    const sourceIds = new Set(run.lineItems.map((li) => li.sourceMeasureElementId));
    expect(sourceIds).toEqual(new Set(['me-door-1', 'me-skirt-1']));
  });

  it('rejects createRun when no takeoff-eligible measures exist', async () => {
    const service = buildS5Service([]);

    await expect(service.createRun(S5_CLAIM_FILE_ID, S5_USER, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects createRun when only unsupported SM types are present', async () => {
    const emptyService = buildS5Service([]);
    await expect(emptyService.createRun(S5_CLAIM_FILE_ID, S5_USER, {})).rejects.toThrow(
      'Metraj üretilecek uygun akıllı ölçüm bulunamadı',
    );
  });

  it('override trail preserved in multi-element run (auditable decision)', async () => {
    const service = buildS5Service(buildMultiElementMeasures());
    const run = await service.createRun(S5_CLAIM_FILE_ID, S5_USER, {});
    const target = run.lineItems.find(
      (li) => li.operationItemCode === OperationItemCodes.SKIRTING_INSTALL,
    )!;

    const updated = await service.applyLineItemOverride(
      S5_CLAIM_FILE_ID,
      run.id,
      target.id,
      S5_USER,
      { quantityOverride: 5.5, reason: 'Saha ölçümü düzeltmesi' },
    );

    expect(updated.quantityEngine).toBe(5.2);
    expect(updated.quantityFinal).toBe(5.5);
    expect(updated.hasOverride).toBe(true);
    expect(updated.overrides[0].reason).toBe('Saha ölçümü düzeltmesi');

    const detail = await service.getRun(S5_CLAIM_FILE_ID, run.id, S5_USER);
    const persisted = detail.lineItems.find((li) => li.id === target.id)!;
    expect(persisted.hasOverride).toBe(true);
    expect(persisted.explanation.overrideSummary).toContain('5.5');
  });

  it('listByElementIds on InMemoryMeasureReadPort filters correctly', async () => {
    const measures = buildMultiElementMeasures();
    const port = new InMemoryMeasureReadPort(measures);

    const subset = await port.listByElementIds(S5_CLAIM_FILE_ID, ['me-window-1']);
    expect(subset).toHaveLength(1);
    expect(subset[0].structureElementType).toBe(StructureElementTypes.WINDOW);
  });
});
