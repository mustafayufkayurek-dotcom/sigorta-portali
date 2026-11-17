import { Module, forwardRef } from '@nestjs/common';
import { BankAccountsController } from './bank-accounts.controller';
import { BankAccountsService } from './bank-accounts.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { FinanceModule } from '@/modules/finance/finance.module';

@Module({
  imports: [PrismaModule, forwardRef(() => FinanceModule)],
  controllers: [BankAccountsController],
  providers: [BankAccountsService],
  exports: [BankAccountsService],
})
export class BankAccountsModule {}
