import { Module } from '@nestjs/common';
import { InsuranceCompaniesService } from './insurance-companies.service';
import { InsuranceCompaniesController } from './insurance-companies.controller';

@Module({
  providers: [InsuranceCompaniesService],
  controllers: [InsuranceCompaniesController],
  exports: [InsuranceCompaniesService],
})
export class InsuranceCompaniesModule {}
