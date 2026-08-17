import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { ExportService } from './export.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { OperationalAccessGrantsModule } from '@/modules/operational-access-grants/operational-access-grants.module';

@Module({
  imports: [PrismaModule, OperationalAccessGrantsModule],
  providers: [DashboardService, ExportService],
  controllers: [DashboardController],
})
export class DashboardModule {}
