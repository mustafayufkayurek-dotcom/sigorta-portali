import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { SurveysService } from './surveys.service';
import { SurveysController } from './surveys.controller';
import { PublicSurveyController } from './public-survey.controller';
import { SurveyReportService } from './survey-report.service';
import { SurveyReportScheduler } from './survey-report.scheduler';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [SurveysController, PublicSurveyController],
  providers: [SurveysService, SurveyReportService, SurveyReportScheduler],
  exports: [SurveysService],
})
export class SurveysModule {}
