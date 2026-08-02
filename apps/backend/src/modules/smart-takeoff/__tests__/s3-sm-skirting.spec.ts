import { mapSmElementTypeToTakeoff } from '../adapters/sm-structure-type.mapper';
import { resolveLengthMm } from '../adapters/prisma-measure-read.adapter';
import { StructureElementTypes } from '../domain/domain.types';
import { CalculationEngine } from '../calculation-engine/calculation-engine';
import { DecisionEngine } from '../decision-engine/decision-engine';
import { TakeoffPipeline } from '../pipeline/takeoff-pipeline';
import { RuleEngine } from '../rule-engine/rule-engine';
import { RuleRegistry } from '../rule-engine/rule-registry';
import { registerS1Rules } from '../rule-library/register-s1-rules';
import { S1_RULE_VERSION_TAG } from '../rule-library/s1-rule-definitions';
import { OperationItemCodes } from '../domain/domain.types';

describe('S3 — SM real data + SKIRTING lengthMm path', () => {
  it('maps Turkish SM element types including window variants', () => {
    expect(mapSmElementTypeToTakeoff('kapi')).toBe(StructureElementTypes.DOOR);
    expect(mapSmElementTypeToTakeoff('KAPI')).toBe(StructureElementTypes.DOOR);
    expect(mapSmElementTypeToTakeoff('pencere')).toBe(StructureElementTypes.WINDOW);
    expect(mapSmElementTypeToTakeoff('pvc_dograma')).toBe(StructureElementTypes.WINDOW);
    expect(mapSmElementTypeToTakeoff('ahsap_dograma')).toBe(StructureElementTypes.WINDOW);
    expect(mapSmElementTypeToTakeoff('tavan')).toBe(StructureElementTypes.CEILING);
    expect(mapSmElementTypeToTakeoff('asma_tavan')).toBe(StructureElementTypes.CEILING);
    expect(mapSmElementTypeToTakeoff('supurgelik')).toBe(StructureElementTypes.SKIRTING);
    expect(mapSmElementTypeToTakeoff('diger')).toBeNull();
  });

  it('respects extensionJson.takeoffStructureType override', () => {
    expect(
      mapSmElementTypeToTakeoff('duvar', { takeoffStructureType: 'SKIRTING' }),
    ).toBe(StructureElementTypes.SKIRTING);
  });

  it('maps extensionJson.metrajElementType supurgelik on duvar elements', () => {
    expect(
      mapSmElementTypeToTakeoff('duvar', { metrajElementType: 'supurgelik' }),
    ).toBe(StructureElementTypes.SKIRTING);
  });

  it('pipeline produces SKIRTING line item from lengthMm via extensionJson', () => {
    const registry = new RuleRegistry();
    registerS1Rules(registry);
    const pipeline = new TakeoffPipeline(
      new DecisionEngine(new RuleEngine(registry)),
      new CalculationEngine(),
    );

    const result = pipeline.runFromMeasure(
      {
        measureElementId: 'me-skirt',
        measureVersionId: 'mv-skirt',
        claimFileId: 'cf-1',
        structureElementType: StructureElementTypes.SKIRTING,
        lengthMm: 4200,
      },
      S1_RULE_VERSION_TAG,
    );

    expect(result.workItems).toHaveLength(1);
    expect(result.workItems[0].operationItemCode).toBe(OperationItemCodes.SKIRTING_INSTALL);
    expect(result.workItems[0].displayName).toBe('Süpürgelik Döşeme');
    expect(result.workItems[0].quantityFinal).toBe(4.2);
    expect(result.workItems[0].unit).toBe('m_tul');
  });

  it('adapter resolveLengthMm uses widthMm as koşu when height absent', () => {
    const length = resolveLengthMm(StructureElementTypes.SKIRTING, {
      widthMm: 3500,
      heightMm: null,
      depthMm: null,
      extensionJson: null,
    });
    expect(length).toBe(3500);
  });

  it('adapter resolveLengthMm prefers extensionJson.lengthMm', () => {
    const length = resolveLengthMm(StructureElementTypes.SKIRTING, {
      widthMm: 1000,
      heightMm: 2000,
      depthMm: null,
      extensionJson: { lengthMm: 4800 },
    });
    expect(length).toBe(4800);
  });
});
