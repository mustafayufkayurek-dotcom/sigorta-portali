import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { ServiceBranchesService } from './service-branches.service';
import { ServiceBranchesController } from './service-branches.controller';

@Module({
  imports: [PrismaModule],
  controllers: [ServiceBranchesController],
  providers: [ServiceBranchesService],
  exports: [ServiceBranchesService],
})
export class ServiceBranchesModule {}
