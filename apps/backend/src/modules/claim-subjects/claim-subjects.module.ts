import { Module } from '@nestjs/common';
import { ClaimSubjectsController } from './claim-subjects.controller';
import { ClaimSubjectsService } from './claim-subjects.service';

@Module({
  controllers: [ClaimSubjectsController],
  providers: [ClaimSubjectsService],
  exports: [ClaimSubjectsService],
})
export class ClaimSubjectsModule {}
