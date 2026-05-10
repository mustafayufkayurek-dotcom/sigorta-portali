import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { ReportTemplatesService } from './report-templates.service';
import { ReportTemplatesController } from './report-templates.controller';

@Module({
  imports: [PrismaModule],
  controllers: [ReportTemplatesController],
  providers: [ReportTemplatesService],
  exports: [ReportTemplatesService],
})
export class ReportTemplatesModule {}
