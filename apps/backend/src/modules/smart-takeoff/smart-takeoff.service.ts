import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ClaimFilesService } from '@/modules/claim-files/claim-files.service';
import { CalculationEngine } from './calculation-engine/calculation-engine';
import { DecisionEngine } from './decision-engine/decision-engine';
import type { ApplyLineItemOverrideDto, CreateTakeoffRunDto } from './dto/takeoff-run.dto';
import { toTakeoffLineItemResponse, toTakeoffRunResponse } from './mappers/takeoff-run.mapper';
import type { TakeoffPipelineResult } from './pipeline/takeoff-pipeline';
import { TakeoffPipeline } from './pipeline/takeoff-pipeline';
import type { MeasureReadPort, MeasureReadSnapshot } from './ports/measure-read.port';
import { MEASURE_READ_PORT } from './ports/measure-read.port';
import {
  TAKEOFF_PERSIST_PORT,
  type TakeoffPersistPort,
} from './ports/takeoff-persist.port';
import { RuleEngine } from './rule-engine/rule-engine';
import { RuleRegistry } from './rule-engine/rule-registry';
import { registerS1Rules } from './rule-library/register-s1-rules';
import { S1_RULE_VERSION_TAG } from './rule-library/s1-rule-definitions';
import { S1_PLACEHOLDER_CALCULATION_VERSION_TAG } from './versioning/version.types';
import { RuleVersionResolver } from './versioning/rule-version-resolver';
import { TAKEOFF_MAX_MEASURES_PER_RUN } from './constants/takeoff-limits';

type RequestUser = { id: string; roleCode?: string };

/**
 * Smart Quantity Takeoff — S5 E2E validation + SM real data flow.
 * S1 pipeline korunur; SM adapter + persist + REST API + override audit.
 *
 * Run lifecycle: createRun → listRuns → getRun → applyLineItemOverride.
 * Re-run: each createRun appends a new run (runNumber++); prior runs immutable.
 */
@Injectable()
export class SmartTakeoffService implements OnModuleInit {
  constructor(
    private readonly ruleRegistry: RuleRegistry,
    private readonly ruleEngine: RuleEngine,
    private readonly decisionEngine: DecisionEngine,
    private readonly calculationEngine: CalculationEngine,
    private readonly pipeline: TakeoffPipeline,
    private readonly claimFiles: ClaimFilesService,
    private readonly ruleVersionResolver: RuleVersionResolver,
    @Inject(MEASURE_READ_PORT)
    private readonly measureRead: MeasureReadPort & {
      listByElementIds?(claimFileId: string, elementIds: string[]): Promise<MeasureReadSnapshot[]>;
    },
    @Inject(TAKEOFF_PERSIST_PORT)
    private readonly persist: TakeoffPersistPort,
  ) {}

  onModuleInit(): void {
    registerS1Rules(this.ruleRegistry);
  }

  ensureS1RulesLoaded(): void {
    if (this.ruleRegistry.count() === 0) {
      registerS1Rules(this.ruleRegistry);
    }
  }

  getSkeletonStatus() {
    this.ensureS1RulesLoaded();
    return {
      sprint: 'S5',
      ruleCount: this.ruleRegistry.count(),
      ruleVersionTag: S1_RULE_VERSION_TAG,
      calculationVersionTag: S1_PLACEHOLDER_CALCULATION_VERSION_TAG,
      engines: {
        ruleEngine: Boolean(this.ruleEngine),
        decisionEngine: Boolean(this.decisionEngine),
        calculationEngine: Boolean(this.calculationEngine),
        pipeline: Boolean(this.pipeline),
      },
      supportedElements: ['DOOR', 'WINDOW', 'SKIRTING', 'CEILING'],
      registeredInAppModule: true,
      apiEndpoints: 4,
      persistence: true,
      persistenceAdapter: this.persist.constructor.name,
      measureReadAdapter: 'PrismaMeasureReadAdapter',
      ruleVersionSource: 'TakeoffRuleVersion (DB)',
      manualOverride: true,
    };
  }

  /** S1 uyumluluk — tek ölçü snapshot ile dikey dilim. */
  runVerticalSlice(measure: MeasureReadSnapshot): TakeoffPipelineResult {
    this.ensureS1RulesLoaded();
    return this.pipeline.runFromMeasure(measure, S1_RULE_VERSION_TAG);
  }

  async createRun(
    claimFileId: string,
    user: RequestUser,
    dto: CreateTakeoffRunDto,
  ) {
    await this.assertClaimAccess(claimFileId, user);
    this.ensureS1RulesLoaded();

    const measures = await this.resolveMeasures(claimFileId, dto.measureElementIds);
    if (measures.length === 0) {
      throw new BadRequestException(
        'Metraj üretilecek uygun akıllı ölçüm bulunamadı. Kapı, pencere, tavan veya süpürgelik ölçüsü gerekir.',
      );
    }
    if (measures.length > TAKEOFF_MAX_MEASURES_PER_RUN) {
      throw new BadRequestException(
        `Tek seferde en fazla ${TAKEOFF_MAX_MEASURES_PER_RUN} ölçü işlenebilir. Lütfen ölçü seçimini daraltın.`,
      );
    }

    const ruleVersion = await this.ruleVersionResolver.resolveCurrent(user.id);

    const workItems = measures.flatMap((measure) => {
      const result = this.pipeline.runFromMeasure(measure, ruleVersion.versionTag);
      return [...result.workItems];
    });

    const run = await this.persist.createRun({
      claimFileId,
      ruleVersionId: ruleVersion.id,
      ruleVersionTag: ruleVersion.versionTag,
      note: dto.note?.trim() || null,
      createdByUserId: user.id,
      workItems,
    });

    return toTakeoffRunResponse(run);
  }

  async listRuns(claimFileId: string, user: RequestUser) {
    await this.assertClaimAccess(claimFileId, user);
    const runs = await this.persist.listRuns(claimFileId);
    return runs.map(toTakeoffRunResponse);
  }

  async getRun(claimFileId: string, runId: string, user: RequestUser) {
    await this.assertClaimAccess(claimFileId, user);
    const run = await this.persist.getRun(claimFileId, runId);
    if (!run) {
      throw new NotFoundException('Metraj koşumu bulunamadı');
    }
    return toTakeoffRunResponse(run);
  }

  async applyLineItemOverride(
    claimFileId: string,
    runId: string,
    lineItemId: string,
    user: RequestUser,
    dto: ApplyLineItemOverrideDto,
  ) {
    await this.assertClaimAccess(claimFileId, user);
    const reason = dto.reason?.trim();
    if (!reason) {
      throw new BadRequestException('Düzeltme gerekçesi zorunludur');
    }

    const run = await this.persist.getRun(claimFileId, runId);
    if (!run) {
      throw new NotFoundException('Metraj koşumu bulunamadı');
    }

    const lineItem = run.lineItems.find((li) => li.id === lineItemId);
    if (!lineItem) {
      throw new NotFoundException('İş kalemi bulunamadı');
    }

    const updated = await this.persist.applyLineItemOverride({
      claimFileId,
      runId,
      lineItemId,
      quantityOverride: dto.quantityOverride,
      reason,
      createdByUserId: user.id,
    });

    return toTakeoffLineItemResponse(updated);
  }

  private async resolveMeasures(
    claimFileId: string,
    measureElementIds?: string[],
  ): Promise<MeasureReadSnapshot[]> {
    if (measureElementIds?.length && this.measureRead.listByElementIds) {
      return this.measureRead.listByElementIds(claimFileId, measureElementIds);
    }
    if (measureElementIds?.length) {
      const all = await this.measureRead.listForClaimFile(claimFileId);
      const idSet = new Set(measureElementIds);
      return all.filter((m) => idSet.has(m.measureElementId));
    }
    return this.measureRead.listForClaimFile(claimFileId);
  }

  private async assertClaimAccess(claimFileId: string, user: RequestUser) {
    if (!user.roleCode) {
      throw new BadRequestException('Kullanıcı rolü doğrulanamadı');
    }
    await this.claimFiles.findOne(claimFileId, {
      id: user.id,
      roleCode: user.roleCode,
    });
  }
}
