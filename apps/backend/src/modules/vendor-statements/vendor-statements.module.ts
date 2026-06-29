import { Module, forwardRef } from '@nestjs/common';
import { VendorStatementsController, VendorStatementsPublicController } from './vendor-statements.controller';
import { VendorStatementsService } from './vendor-statements.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [PrismaModule, forwardRef(() => PaymentsModule)],
  controllers: [VendorStatementsController, VendorStatementsPublicController],
  providers: [VendorStatementsService],
  exports: [VendorStatementsService],
})
export class VendorStatementsModule {}
