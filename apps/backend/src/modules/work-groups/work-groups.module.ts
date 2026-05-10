import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { WorkGroupsController } from './work-groups.controller';
import { WorkGroupsService } from './work-groups.service';
import { PrismaModule } from '@/prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    MulterModule.register({ limits: { fileSize: 10 * 1024 * 1024 } }),
  ],
  controllers: [WorkGroupsController],
  providers: [WorkGroupsService],
  exports: [WorkGroupsService],
})
export class WorkGroupsModule {}
