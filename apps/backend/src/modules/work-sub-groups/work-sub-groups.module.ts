import { Module } from '@nestjs/common';
import { WorkSubGroupsController } from './work-sub-groups.controller';
import { WorkSubGroupsService } from './work-sub-groups.service';
import { PrismaModule } from '@/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [WorkSubGroupsController],
  providers: [WorkSubGroupsService],
  exports: [WorkSubGroupsService],
})
export class WorkSubGroupsModule {}
