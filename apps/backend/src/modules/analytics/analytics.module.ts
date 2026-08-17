import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { PrismaModule } from '@/prisma/prisma.module';
import { ClaimFilesModule } from '@/modules/claim-files/claim-files.module';

@Module({
  imports: [PrismaModule, ClaimFilesModule],
  providers: [AnalyticsService],
  controllers: [AnalyticsController],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
