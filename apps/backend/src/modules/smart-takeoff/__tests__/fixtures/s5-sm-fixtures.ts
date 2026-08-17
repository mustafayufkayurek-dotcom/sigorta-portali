import { CalculationEngine } from '../../calculation-engine/calculation-engine';
import { DecisionEngine } from '../../decision-engine/decision-engine';
import {
  IN_MEMORY_RULE_VERSION_ID,
  InMemoryTakeoffPersistAdapter,
} from '../../adapters/in-memory-takeoff-persist.adapter';
import { InMemoryMeasureReadPort } from '../../ports/measure-read.port';
import type { MeasureReadSnapshot } from '../../ports/measure-read.port';
import { StructureElementTypes } from '../../domain/domain.types';
import { TakeoffPipeline } from '../../pipeline/takeoff-pipeline';
import { RuleEngine } from '../../rule-engine/rule-engine';
import { RuleRegistry } from '../../rule-engine/rule-registry';
import { registerS1Rules } from '../../rule-library/register-s1-rules';
import { SmartTakeoffService } from '../../smart-takeoff.service';
import { RuleVersionResolver } from '../../versioning/rule-version-resolver';

export const S5_CLAIM_FILE_ID = 'cf-s5-e2e';
export const S5_USER = { id: 'user-s5', roleCode: 'admin' } as const;

/** Realistic SM-mapped snapshots for a multi-element claim file. */
export function buildMultiElementMeasures(claimFileId = S5_CLAIM_FILE_ID): MeasureReadSnapshot[] {
  return [
    {
      measureElementId: 'me-door-1',
      measureVersionId: 'mv-door-1',
      claimFileId,
      structureElementType: StructureElementTypes.DOOR,
      widthMm: 2100,
      heightMm: 900,
    },
    {
      measureElementId: 'me-window-1',
      measureVersionId: 'mv-window-1',
      claimFileId,
      structureElementType: StructureElementTypes.WINDOW,
      widthMm: 1200,
      heightMm: 1400,
    },
    {
      measureElementId: 'me-ceiling-1',
      measureVersionId: 'mv-ceiling-1',
      claimFileId,
      structureElementType: StructureElementTypes.CEILING,
      widthMm: 4000,
      heightMm: 3500,
    },
    {
      measureElementId: 'me-skirt-1',
      measureVersionId: 'mv-skirt-1',
      claimFileId,
      structureElementType: StructureElementTypes.SKIRTING,
      lengthMm: 5200,
    },
  ];
}

/** Generates N door measures for performance scenarios. */
export function buildManyDoorMeasures(
  count: number,
  claimFileId = S5_CLAIM_FILE_ID,
): MeasureReadSnapshot[] {
  return Array.from({ length: count }, (_, i) => ({
    measureElementId: `me-door-perf-${i}`,
    measureVersionId: `mv-door-perf-${i}`,
    claimFileId,
    structureElementType: StructureElementTypes.DOOR,
    widthMm: 2000 + (i % 5) * 50,
    heightMm: 800 + (i % 3) * 20,
  }));
}

/** Prisma-shaped SM rows before adapter mapping. */
export function buildPrismaSmElementRow(
  partial: {
    id: string;
    elementType: string;
    widthMm?: number | null;
    heightMm?: number | null;
    depthMm?: number | null;
    extensionJson?: unknown;
    versionId?: string;
    noVersion?: boolean;
  },
) {
  return {
    id: partial.id,
    elementType: partial.elementType,
    versions: partial.noVersion
      ? []
      : [
          {
            id: partial.versionId ?? `mv-${partial.id}`,
            widthMm: partial.widthMm ?? null,
            heightMm: partial.heightMm ?? null,
            depthMm: partial.depthMm ?? null,
            extensionJson: partial.extensionJson ?? null,
          },
        ],
  };
}

export function buildS5Service(
  measures: MeasureReadSnapshot[] = buildMultiElementMeasures(),
  persist = new InMemoryTakeoffPersistAdapter(),
): SmartTakeoffService {
  const registry = new RuleRegistry();
  registerS1Rules(registry);
  const ruleEngine = new RuleEngine(registry);
  const decisionEngine = new DecisionEngine(ruleEngine);
  const calculationEngine = new CalculationEngine();
  const pipeline = new TakeoffPipeline(decisionEngine, calculationEngine);
  const measureRead = new InMemoryMeasureReadPort(measures);
  const ruleVersionResolver = {
    resolveCurrent: jest.fn().mockResolvedValue({
      id: IN_MEMORY_RULE_VERSION_ID,
      versionTag: 's1.2026.08.02.1',
      librarySnapshotHash: 'test',
      effectiveFrom: new Date('2026-08-02'),
    }),
  } as unknown as RuleVersionResolver;

  const service = new SmartTakeoffService(
    registry,
    ruleEngine,
    decisionEngine,
    calculationEngine,
    pipeline,
    { findOne: jest.fn().mockResolvedValue({ id: S5_CLAIM_FILE_ID }) } as never,
    ruleVersionResolver,
    measureRead,
    persist,
  );
  service.ensureS1RulesLoaded();
  return service;
}
