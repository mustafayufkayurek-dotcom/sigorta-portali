import { Module } from '@nestjs/common';
import { PlatformModulesModule } from '@/modules/platform-modules/platform-modules.module';
import { FixedAssetsController } from './fixed-assets.controller';
import { PlatformModuleGuard } from '@/common/guards/platform-module.guard';

@Module({
  imports: [PlatformModulesModule],
  controllers: [FixedAssetsController],
  providers: [PlatformModuleGuard],
})
export class FixedAssetsModule {}
