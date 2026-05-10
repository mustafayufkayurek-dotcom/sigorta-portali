import { Module } from '@nestjs/common';
import { TaxVerificationController } from './tax-verification.controller';
import { TaxVerificationService } from './tax-verification.service';

@Module({
  controllers: [TaxVerificationController],
  providers: [TaxVerificationService],
  exports: [TaxVerificationService],
})
export class TaxVerificationModule {}
