import { Module } from '@nestjs/common';
import { ClaimResponsibilitiesController } from './claim-responsibilities.controller';
import { ClaimResponsibilitiesService } from './claim-responsibilities.service';

@Module({
  controllers: [ClaimResponsibilitiesController],
  providers: [ClaimResponsibilitiesService],
  exports: [ClaimResponsibilitiesService],
})
export class ClaimResponsibilitiesModule {}
