import {
  Injectable,
  CanActivate,
  ExecutionContext,
  NotFoundException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlatformModulesService } from '@/modules/platform-modules/platform-modules.service';

export const PLATFORM_MODULE_KEY = 'platformModuleCode';

export const RequirePlatformModule = (code: string) =>
  SetMetadata(PLATFORM_MODULE_KEY, code);

@Injectable()
export class PlatformModuleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly platformModules: PlatformModulesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const code = this.reflector.getAllAndOverride<string>(PLATFORM_MODULE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!code) return true;

    const enabled = await this.platformModules.isEnabled(code);
    if (!enabled) {
      throw new NotFoundException('Bu modül henüz etkin değil.');
    }
    return true;
  }
}
