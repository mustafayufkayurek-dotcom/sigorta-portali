import { Module } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';
import { CustomerAccessLogModule } from '@/modules/customer-access-log/customer-access-log.module';
import { PrismaModule } from '@/prisma/prisma.module';

@Module({
  imports: [CustomerAccessLogModule, PrismaModule],
  providers: [CustomersService],
  controllers: [CustomersController],
  exports: [CustomersService],
})
export class CustomersModule {}
