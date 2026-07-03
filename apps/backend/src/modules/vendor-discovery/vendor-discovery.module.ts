import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import { VendorDiscoveryController } from './vendor-discovery.controller';
import { VendorDiscoveryService } from './vendor-discovery.service';

@Module({
  imports: [
    HttpModule.register({ timeout: 15_000, maxRedirects: 3 }),
    SystemSettingsModule,
  ],
  controllers: [VendorDiscoveryController],
  providers: [VendorDiscoveryService],
  exports: [VendorDiscoveryService],
})
export class VendorDiscoveryModule {}
