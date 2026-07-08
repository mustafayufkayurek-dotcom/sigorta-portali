import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';
import { ClaimFilesModule } from '@/modules/claim-files/claim-files.module';

@Module({
  imports: [PrismaModule, ClaimFilesModule],
  controllers: [ExpensesController],
  providers: [ExpensesService],
  exports: [ExpensesService],
})
export class ExpensesModule {}
