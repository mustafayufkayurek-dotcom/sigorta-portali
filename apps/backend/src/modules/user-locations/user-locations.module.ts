import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { UserLocationsController } from './user-locations.controller';
import { UserLocationsService } from './user-locations.service';
import { LocationCleanupScheduler } from './location-cleanup.scheduler';

@Module({
  imports: [PrismaModule],
  controllers: [UserLocationsController],
  providers: [UserLocationsService, LocationCleanupScheduler],
  exports: [UserLocationsService],
})
export class UserLocationsModule {}
