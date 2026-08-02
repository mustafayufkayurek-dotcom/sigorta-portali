import { Module } from '@nestjs/common';
import { ClaimFilesModule } from '@/modules/claim-files/claim-files.module';
import { PrismaModule } from '@/prisma/prisma.module';
import { InMemoryTakeoffPersistAdapter } from './adapters/in-memory-takeoff-persist.adapter';
import { PrismaMeasureReadAdapter } from './adapters/prisma-measure-read.adapter';
import { CalculationEngine } from './calculation-engine/calculation-engine';
import { DecisionEngine } from './decision-engine/decision-engine';
import { TakeoffPipeline } from './pipeline/takeoff-pipeline';
import { MEASURE_READ_PORT } from './ports/measure-read.port';
import { TAKEOFF_PERSIST_PORT } from './ports/takeoff-persist.port';
import { RuleEngine } from './rule-engine/rule-engine';
import { RuleRegistry } from './rule-engine/rule-registry';
import { SmartTakeoffController } from './smart-takeoff.controller';
import { SmartTakeoffService } from './smart-takeoff.service';

/**
 * Smart Quantity Takeoff — S2 platform bağlantısı.
 * BUILD MODE: InMemory persist (Review Gate migration sonrası Prisma).
 */
@Module({
  imports: [PrismaModule, ClaimFilesModule],
  controllers: [SmartTakeoffController],
  providers: [
    RuleRegistry,
    RuleEngine,
    DecisionEngine,
    CalculationEngine,
    TakeoffPipeline,
    SmartTakeoffService,
    PrismaMeasureReadAdapter,
    {
      provide: MEASURE_READ_PORT,
      useExisting: PrismaMeasureReadAdapter,
    },
    {
      provide: TAKEOFF_PERSIST_PORT,
      useClass: InMemoryTakeoffPersistAdapter,
    },
  ],
  exports: [SmartTakeoffService],
})
export class SmartTakeoffModule {}
