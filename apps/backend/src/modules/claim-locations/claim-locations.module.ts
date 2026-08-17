import { Module } from '@nestjs/common';
import { ClaimLocationsController } from './claim-locations.controller';
import { ClaimLocationsService } from './claim-locations.service';
import { PrismaModule } from '@/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ClaimLocationsController],
  providers: [ClaimLocationsService],
  exports: [ClaimLocationsService],
})
export class ClaimLocationsModule {}
