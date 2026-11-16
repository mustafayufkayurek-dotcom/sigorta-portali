import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';
import { ClaimFilesModule } from '@/modules/claim-files/claim-files.module';
import { FinanceModule } from '@/modules/finance/finance.module';

@Module({
  imports: [PrismaModule, ClaimFilesModule, forwardRef(() => FinanceModule)],
  controllers: [ExpensesController],
  providers: [ExpensesService],
  exports: [ExpensesService],
})
export class ExpensesModule {}
