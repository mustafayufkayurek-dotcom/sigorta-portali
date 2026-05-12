import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { ClaimStatusController } from './claim-status.controller';
import { ClaimStatusService } from './claim-status.service';

@Module({
  imports: [PrismaModule],
  controllers: [ClaimStatusController],
  providers: [ClaimStatusService],
  exports: [ClaimStatusService],
})
export class ClaimStatusModule {}