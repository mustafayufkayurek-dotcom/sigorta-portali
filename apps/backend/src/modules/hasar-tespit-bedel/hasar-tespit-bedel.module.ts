import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { LocationsModule } from '@/modules/locations/locations.module';
import { FinanceModule } from '@/modules/finance/finance.module';
import { ExpensesModule } from '@/modules/expenses/expenses.module';
import { HasarTespitBedelController } from './hasar-tespit-bedel.controller';
import { HasarTespitBedelService } from './hasar-tespit-bedel.service';

@Module({
  imports: [PrismaModule, LocationsModule, FinanceModule, ExpensesModule],
  controllers: [HasarTespitBedelController],
  providers: [HasarTespitBedelService],
})
export class HasarTespitBedelModule {}
