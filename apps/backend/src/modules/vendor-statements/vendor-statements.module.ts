import { Module } from '@nestjs/common';
import { VendorStatementsController, VendorStatementsPublicController } from './vendor-statements.controller';
import { VendorStatementsService } from './vendor-statements.service';
import { PrismaModule } from '@/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [VendorStatementsController, VendorStatementsPublicController],
  providers: [VendorStatementsService],
  exports: [VendorStatementsService],
})
export class VendorStatementsModule {}
