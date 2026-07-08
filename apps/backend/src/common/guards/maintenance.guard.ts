import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class MaintenanceGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (process.env.SYSTEM_MAINTENANCE_MODE !== 'true') {
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const method = String(request.method ?? 'GET').toUpperCase();

    if (!MUTATING_METHODS.has(method)) {
      return true;
    }

    const path = String(request.path ?? request.url ?? '');
    if (path.includes('/health')) {
      return true;
    }

    throw new ServiceUnavailableException('Sistem bakımda; veri girişi geçici olarak kapalı.');
  }
}
