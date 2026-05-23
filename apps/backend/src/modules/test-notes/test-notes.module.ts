import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { AuditLogsModule } from '@/modules/audit-logs/audit-logs.module';
import { TestNotesController } from './test-notes.controller';
import { WorkItemsController } from './work-items.controller';
import { TestNotesService } from './test-notes.service';

@Module({
  imports: [PrismaModule, AuditLogsModule],
  controllers: [TestNotesController, WorkItemsController],
  providers: [TestNotesService],
  exports: [TestNotesService],
})
export class TestNotesModule {}