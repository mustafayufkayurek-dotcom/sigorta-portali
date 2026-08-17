import { Module } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';
import { CustomerAccessLogModule } from '@/modules/customer-access-log/customer-access-log.module';
import { ClaimFilesModule } from '@/modules/claim-files/claim-files.module';
import { EmergencyModule } from '@/modules/emergency/emergency.module';
import { SystemSettingsModule } from '@/modules/system-settings/system-settings.module';
import { PrismaModule } from '@/prisma/prisma.module';

@Module({
  imports: [CustomerAccessLogModule, ClaimFilesModule, EmergencyModule, SystemSettingsModule, PrismaModule],
  providers: [CustomersService],
  controllers: [CustomersController],
  exports: [CustomersService],
})
export class CustomersModule {}
