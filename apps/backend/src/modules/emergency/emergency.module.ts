import { Module } from '@nestjs/common';
import { EmergencyCasesController } from './emergency-cases.controller';
import { EmergencyFinanceController } from './emergency-finance.controller';
import { EmergencyCasesService } from './emergency-cases.service';
import { EmergencyFinanceService } from './emergency-finance.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { ClaimFilesModule } from '@/modules/claim-files/claim-files.module';
import { OperationalAccessGrantsModule } from '@/modules/operational-access-grants/operational-access-grants.module';

@Module({
  imports: [PrismaModule, ClaimFilesModule, OperationalAccessGrantsModule],
  controllers: [EmergencyCasesController, EmergencyFinanceController],
  providers: [EmergencyCasesService, EmergencyFinanceService],
  exports: [EmergencyCasesService, EmergencyFinanceService],
})
export class EmergencyModule {}
